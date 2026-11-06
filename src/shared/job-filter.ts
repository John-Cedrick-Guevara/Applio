import type { JobFilter } from './api';
import type { Job } from './types';

/** Whether a job passes a `listJobs` filter; every given field must hold. Used by the backend and the mock. */
export function matchesFilter(job: Job, filter: JobFilter): boolean {
  if (filter.statuses && !filter.statuses.includes(job.status)) return false;
  if (filter.minScore !== undefined && (job.score ?? 0) < filter.minScore) return false;
  if (filter.search) {
    const q = filter.search.toLowerCase();
    if (!`${job.company} ${job.title}`.toLowerCase().includes(q)) return false;
  }
  return true;
}
