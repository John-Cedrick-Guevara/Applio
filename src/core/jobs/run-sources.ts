import type { DiscoveredJob, HttpGet, JobSource } from './source';

/** Polls per source per local day (SPEC F10 "Board APIs"); SQLite implements it. */
export interface PollCounter {
  count(sourceId: string, day: string): number;
  record(sourceId: string, day: string): void;
}

export type SourceOutcome = 'ok' | 'disabled' | 'limit' | 'failed';

export interface SourceResult {
  sourceId: string;
  outcome: SourceOutcome;
  jobs: number;
  dropped: number;
  /** Operator-readable reason when `outcome` is 'failed'. */
  error?: string;
  /** Partial problems from a source that otherwise worked. */
  notes?: string[];
}

export interface RunSourcesResult {
  jobs: DiscoveredJob[];
  /** One entry per source, in the order given. */
  sources: SourceResult[];
}

interface RunOptions {
  sources: readonly JobSource[];
  isEnabled: (sourceId: string) => boolean;
  polls: PollCounter;
  httpFor: (source: JobSource) => HttpGet;
  today: () => string;
}

/** The operator's calendar day ("2026-11-05"), which poll limits reset on. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Polls every enabled source under its daily limit, in parallel across sources.
 * A source that fails is recorded and skipped; it never aborts the run
 * (CLAUDE.md §3). A poll counts against the limit before it runs, so a
 * broken board isn't retried all day.
 */
export async function runSources({ sources, isEnabled, polls, httpFor, today }: RunOptions): Promise<RunSourcesResult> {
  const day = today();
  const results = await Promise.all(
    sources.map(async (source): Promise<{ result: SourceResult; jobs: DiscoveredJob[] }> => {
      const empty = (outcome: SourceOutcome, error?: string) => ({
        result: { sourceId: source.id, outcome, jobs: 0, dropped: 0, ...(error ? { error } : {}) },
        jobs: [],
      });
      if (!isEnabled(source.id)) return empty('disabled');
      if (polls.count(source.id, day) >= source.dailyPollLimit) return empty('limit');
      polls.record(source.id, day);
      try {
        const { jobs, dropped, notes } = await source.fetchJobs(httpFor(source));
        return { result: { sourceId: source.id, outcome: 'ok', jobs: jobs.length, dropped, ...(notes?.length ? { notes } : {}) }, jobs };
      } catch (err) {
        return empty('failed', err instanceof Error ? err.message : String(err));
      }
    }),
  );
  return { jobs: results.flatMap((r) => r.jobs), sources: results.map((r) => r.result) };
}
