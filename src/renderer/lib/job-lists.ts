import type { JobStatus } from '../../shared/types';

/** Statuses Review lists: anything still waiting on Applio or the operator before it's out. */
export const REVIEW_STATUSES = ['found', 'scored', 'drafted', 'approved'] as const satisfies readonly JobStatus[];

/** Statuses Applications lists: anything that went out. */
export const APPLICATION_STATUSES = ['applied', 'replied', 'interview', 'offer', 'rejected', 'ghosted'] as const satisfies readonly JobStatus[];
