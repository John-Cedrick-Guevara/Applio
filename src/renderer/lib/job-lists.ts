import type { Job, JobStatus } from '../../shared/types';

/** Statuses Review lists: anything still waiting on Applio or the operator before it's out. */
export const REVIEW_STATUSES = ['found', 'scored', 'drafted', 'approved'] as const satisfies readonly JobStatus[];

/** Statuses Applications lists: anything that went out. */
export const APPLICATION_STATUSES = ['applied', 'replied', 'interview', 'offer', 'rejected', 'ghosted'] as const satisfies readonly JobStatus[];

/** Jobs a scan saves carry the scan's time as their first event, so "new since the last scan" is read from the record. */
export function isNew(job: Pick<Job, 'history'>, lastRunAt?: string): boolean {
  return !!lastRunAt && (job.history[0]?.at ?? '') >= lastRunAt;
}

/** How many jobs are new since the last scan, for the nav. */
export function newCount(jobs: readonly Pick<Job, 'history'>[], lastRunAt?: string): number {
  return jobs.filter((j) => isNew(j, lastRunAt)).length;
}
