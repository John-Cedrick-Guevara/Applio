import { AppError } from '../../shared/errors';
import type { Job, Preferences, RunSummary, ScanPhase } from '../../shared/types';
import { detectChannel } from '../apply/channel';
import type { DraftResult } from '../generation/draft-jobs';
import type { ScoreResult } from '../scoring/score-jobs';
import { triage, type KeyedJob, type TriageReport } from '../triage';
import type { RunSourcesResult, SourceResult } from './run-sources';

/**
 * Discovery with no target role set. Running anyway would store every remote
 * job as found, and stored jobs are never filtered again once roles are set.
 */
export class NoTargetRolesError extends AppError {
  constructor() {
    super('no_target_roles', 'Add at least one target role in Profile, then run discovery again.');
  }
}

/** What a run stores beyond its summary: why jobs were dropped, and how each source went. */
export interface RunDetails {
  duplicates: number;
  dropped: TriageReport['dropped'];
  sources: SourceResult[];
  /** How scoring went (SPEC F3.3); absent until scoring finishes. */
  scoring?: ScoreResult;
  /** How drafting went (SPEC F4); absent until drafting finishes. */
  drafting?: DraftResult;
  /** Set when scoring or drafting failed as a whole; the run and its jobs are kept. */
  scoringError?: string;
}

export type { ScanPhase };

export interface DiscoverPorts {
  poll: () => Promise<RunSourcesResult>;
  /** Dedup keys of every job already stored, sent ones included. */
  existingKeys: () => ReadonlySet<string>;
  /** Keys of every job an earlier run saw, dropped ones included. */
  seenKeys: () => ReadonlySet<string>;
  /** `homeLocation`: the operator's profile location line, for the location rule. */
  filters: () => { preferences: Preferences; blocklist: readonly string[]; homeLocation: string };
  /**
   * Stores the new jobs, the run and the keys it saw together, so a crash can't leave one without the others.
   * @returns The run's id.
   */
  save: (jobs: { job: Job; dedupKey: string }[], details: RunDetails, summary: RunSummary, seen: readonly string[]) => number;
  /** Scores the new jobs, charging their tokens to the run. */
  score: (jobIds: readonly string[], runId: number) => Promise<ScoreResult>;
  /** Drafts the strong matches, charging their tokens to the run. */
  draft: (jobIds: readonly string[], runId: number) => Promise<DraftResult>;
  /** Replaces the run's stored details and drafted count once its AI work is done. */
  finishRun: (runId: number, details: RunDetails, drafted: number) => void;
  /**
   * Jobs earlier runs left behind: found but never scored, and strong matches
   * whose draft failed. Each run retries them, so one engine outage doesn't strand them.
   */
  leftover: () => { unscored: readonly string[]; undrafted: readonly string[] };
  now: () => Date;
  newId: () => string;
  /** Called as each phase starts. */
  onPhase: (phase: ScanPhase) => void;
  /** True once the operator asked to stop; checked between phases, never mid-call. */
  stopped: () => boolean;
}

/** A job that passed triage, as the brain stores it: found, not yet scored (SPEC F7). */
const toJob = (j: KeyedJob, id: string, at: string): Job => ({
  id,
  sourceId: j.sourceId,
  sourceName: j.sourceName,
  company: j.company,
  title: j.title,
  // The board's page, not the apply link: boards require the link back as credit.
  url: j.boardUrl,
  location: j.location,
  salary: j.salary,
  // ponytail: boards that don't say are mostly full-time; PR-16's scoring can correct it from the description.
  employmentType: j.employmentType ?? 'full-time',
  postedAt: j.postedAt,
  status: 'found',
  ...detectChannel(j.applyUrl),
  applyUrl: j.applyUrl,
  description: j.description,
  tags: j.tags,
  strengths: [],
  gaps: [],
  factsUsed: 0,
  tokensUsed: 0,
  history: [{ status: 'found', at }],
});

/**
 * One scan (SPEC F2–F3): poll the sources, drop duplicates and misfits for free,
 * store what's left as found jobs and score them. Strong matches are drafted only
 * when the operator asked (`draft`), since drafting is the expensive step. A stop
 * between phases keeps what's done; unscored jobs are scored on the next scan.
 * @throws NoTargetRolesError before polling when no target role is set.
 */
export async function discover(ports: DiscoverPorts, { draft = false }: { draft?: boolean } = {}): Promise<RunSummary> {
  const filters = ports.filters();
  if (!filters.preferences.targetRoles.some((r) => r.trim())) throw new NoTargetRolesError();
  ports.onPhase('fetching');
  const polled = await ports.poll();
  ports.onPhase('filtering');
  // Nothing fetched because every source is at its daily limit, and nothing waiting to retry: no run to record.
  const atLimit = polled.sources.filter((s) => s.outcome === 'limit').length;
  const leftoverNow = ports.leftover();
  if (polled.jobs.length === 0 && atLimit > 0 && polled.sources.every((s) => s.outcome === 'limit' || s.outcome === 'disabled') && leftoverNow.unscored.length === 0 && leftoverNow.undrafted.length === 0) {
    return { at: ports.now().toISOString(), found: 0, newAfterDedup: 0, passedFilters: 0, drafted: 0, atLimit };
  }
  const { passed, fresh, report } = triage(polled.jobs, { existingKeys: ports.existingKeys(), ...filters });
  const at = ports.now().toISOString();
  // New means no run saw it before; jobs the filters dropped last time aren't new again.
  const seen = ports.seenKeys();
  const summary: RunSummary = { at, found: report.found, newAfterDedup: fresh.filter((k) => !seen.has(k)).length, passedFilters: report.passed, drafted: 0 };
  const jobs = passed.map((j) => ({ job: toJob(j, ports.newId(), at), dedupKey: j.dedupKey }));
  const details: RunDetails = { duplicates: report.duplicates, dropped: report.dropped, sources: polled.sources };
  // Read before saving, so this run's new jobs aren't counted as left over too.
  const leftover = ports.leftover();
  const runId = ports.save(jobs, details, summary, fresh);
  if (ports.stopped()) {
    ports.finishRun(runId, details, 0);
    return { ...summary, stopped: true };
  }
  try {
    ports.onPhase('scoring');
    // ponytail: a job that always fails scoring is retried every run; the budget guard caps the cost.
    const scoring = await ports.score([...jobs.map((j) => j.job.id), ...leftover.unscored], runId);
    if (!draft || ports.stopped()) {
      // Strong matches wait in Review, one click from a draft.
      ports.finishRun(runId, { ...details, scoring }, 0);
      return draft ? { ...summary, stopped: true } : summary;
    }
    ports.onPhase('drafting');
    const drafting = await ports.draft([...scoring.toDraft, ...leftover.undrafted], runId);
    ports.finishRun(runId, { ...details, scoring, drafting }, drafting.drafted);
    return { ...summary, drafted: drafting.drafted };
  } catch (err) {
    // The jobs are saved already; a later run won't re-find them, so record why their AI work stopped.
    ports.finishRun(runId, { ...details, scoringError: err instanceof Error ? err.message : String(err) }, 0);
    return summary;
  }
}
