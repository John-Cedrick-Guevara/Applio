import { AppError } from '../../shared/errors';
import type { Job, Preferences, RunSummary } from '../../shared/types';
import { detectChannel } from '../apply/channel';
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
}

export interface DiscoverPorts {
  poll: () => Promise<RunSourcesResult>;
  /** Dedup keys of every job already stored, sent ones included. */
  existingKeys: () => ReadonlySet<string>;
  filters: () => { preferences: Preferences; blocklist: readonly string[] };
  /** Stores the new jobs and the run together, so a crash can't leave one without the other. */
  save: (jobs: { job: Job; dedupKey: string }[], details: RunDetails, summary: RunSummary) => void;
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
 * misfits for free, and store what's left as found jobs. Scoring and drafting
 * join in PR-16/17, so `drafted` is 0 for now.
 * @throws NoTargetRolesError before polling when no target role is set.
 */
export async function discover(ports: DiscoverPorts): Promise<RunSummary> {
  const filters = ports.filters();
  if (!filters.preferences.targetRoles.some((r) => r.trim())) throw new NoTargetRolesError();
  const polled = await ports.poll();
  const { passed, report } = triage(polled.jobs, { existingKeys: ports.existingKeys(), ...filters });
  const at = ports.now().toISOString();
  const summary: RunSummary = { at, found: report.found, newAfterDedup: report.found - report.duplicates, passedFilters: report.passed, drafted: 0 };
  ports.save(
    passed.map((j) => ({ job: toJob(j, ports.newId(), at), dedupKey: j.dedupKey })),
    { duplicates: report.duplicates, dropped: report.dropped, sources: polled.sources },
    summary,
  );
  return summary;
}
