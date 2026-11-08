import type { JobStatus } from './types';

/**
 * Allowed manual moves out of each status (SPEC F7). Earlier pipeline steps
 * (found → scored → drafted) are driven by the app, so only skipping is manual.
 */
const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  found: ['skipped'],
  scored: ['skipped'],
  drafted: ['approved', 'skipped'],
  approved: ['applied'],
  applied: ['replied', 'interview', 'rejected', 'ghosted'],
  replied: ['interview', 'rejected', 'ghosted'],
  interview: ['offer', 'rejected'],
  offer: [],
  rejected: [],
  ghosted: [],
  skipped: [],
};

/** Statuses the operator may move a job to next. */
export function nextStatuses(status: JobStatus): JobStatus[] {
  return TRANSITIONS[status];
}

/** Every job status, from the transition table, so a new status can't be missed by lists that must cover them all. */
export const JOB_STATUSES = Object.keys(TRANSITIONS) as JobStatus[];
