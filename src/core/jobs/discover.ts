import { AppError } from '../../shared/errors';
import type { Job, Preferences, RunSummary } from '../../shared/types';
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

export interface DiscoverPorts {
  poll: () => Promise<RunSourcesResult>;
  /** Dedup keys of every job already stored, sent ones included. */
  existingKeys: () => ReadonlySet<string>;
  filters: () => { preferences: Preferences; blocklist: readonly string[] };
  /** Stores the new jobs and the run together, so a crash can't leave one without the other. @returns The run's id. */
  save: (jobs: { job: Job; dedupKey: string }[], details: RunDetails, summary: RunSummary) => number;
  /** Scores the new jobs, charging their tokens to the run. */
  score: (jobIds: readonly string[], runId: number) => Promise<ScoreResult>;
  /** Drafts the strong matches, charging their tokens to the run. */
  draft: (jobIds: readonly string[], runId: number) => Promise<DraftResult>;
  /** Replaces the run's stored details and drafted count once its AI work is done. */
  finishRun: (runId: number, details: RunDetails, drafted: number) => void;
  now: () => Date;
  newId: () => string;
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
  description: j.description,
  tags: j.tags,
  strengths: [],
  gaps: [],
  factsUsed: 0,
  tokensUsed: 0,
  history: [{ status: 'found', at }],
});

/**
 * One discovery run (SPEC F2–F3): poll every source, drop duplicates and
 * misfits for free, store what's left as found jobs, score them, and draft
 * the strong matches.
 * @throws NoTargetRolesError before polling when no target role is set.
 */
export async function discover(ports: DiscoverPorts): Promise<RunSummary> {
  const filters = ports.filters();
  if (!filters.preferences.targetRoles.some((r) => r.trim())) throw new NoTargetRolesError();
  const polled = await ports.poll();
  const { passed, report } = triage(polled.jobs, { existingKeys: ports.existingKeys(), ...filters });
  const at = ports.now().toISOString();
  const summary: RunSummary = { at, found: report.found, newAfterDedup: report.found - report.duplicates, passedFilters: report.passed, drafted: 0 };
  const jobs = passed.map((j) => ({ job: toJob(j, ports.newId(), at), dedupKey: j.dedupKey }));
  const details: RunDetails = { duplicates: report.duplicates, dropped: report.dropped, sources: polled.sources };
  const runId = ports.save(jobs, details, summary);
  try {
    const scoring = await ports.score(jobs.map((j) => j.job.id), runId);
    const drafting = await ports.draft(scoring.toDraft, runId);
    ports.finishRun(runId, { ...details, scoring, drafting }, drafting.drafted);
    return { ...summary, drafted: drafting.drafted };
  } catch (err) {
    // The jobs are saved already; a later run won't re-find them, so record why their AI work stopped.
    ports.finishRun(runId, { ...details, scoringError: err instanceof Error ? err.message : String(err) }, 0);
    return summary;
  }
}
