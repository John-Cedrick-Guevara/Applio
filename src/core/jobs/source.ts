import type { EmploymentType } from '../../shared/types';

/** A job as a source reports it, normalized but not yet deduped, filtered or scored (SPEC F2). */
export interface DiscoveredJob {
  sourceId: string;
  /** Board name for attribution, e.g. "Remote OK". */
  sourceName: string;
  /** The board's own id for the job. Stable across polls. */
  externalId: string;
  company: string;
  title: string;
  /** The job's page on the board — the link back that boards require as credit. */
  boardUrl: string;
  /** Where the application goes; can equal `boardUrl` when the board hides it. */
  applyUrl: string;
  /** Plain text, HTML removed. */
  description: string;
  location: string;
  postedAt: string;
  tags: string[];
  /** Undefined when the board doesn't say. */
  remote?: boolean;
  salary?: string;
  employmentType?: EmploymentType;
}

/** The read-only HTTP a source may use; the infra client adds politeness and the host allowlist. */
export interface HttpGet {
  getJson(url: string): Promise<unknown>;
  getText(url: string): Promise<string>;
}

/** What one poll of a source produced. */
export interface SourceFetch {
  jobs: DiscoveredJob[];
  /** Items in the response that didn't match the expected shape and were skipped. */
  dropped: number;
  /** Partial problems worth showing the operator, e.g. one watchlist company whose board is gone. */
  notes?: string[];
}

/** One job board or feed. Adding a source means adding one of these, not editing a switch. */
export interface JobSource {
  /** Matches `Source.id` in settings. */
  id: string;
  name: string;
  /** Polls allowed per local day, from the board's terms (SPEC F10 "Board APIs"). */
  dailyPollLimit: number;
  /** Hosts this source may contact; the HTTP client refuses all others. */
  hosts: readonly string[];
  /** @throws when the source can't be read; the runner records it and moves on. */
  fetchJobs(http: HttpGet): Promise<SourceFetch>;
}
