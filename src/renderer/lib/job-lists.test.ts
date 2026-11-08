import { describe, expect, it } from 'vitest';
import { JOB_STATUSES } from '../../shared/status';
import { APPLICATION_STATUSES, REVIEW_STATUSES } from './job-lists';

const listed = new Set<string>([...REVIEW_STATUSES, ...APPLICATION_STATUSES]);

describe('job lists', () => {
  // Skipped is the operator's own dismissal, so it is the one status no list shows.
  it.each(JOB_STATUSES.filter((s) => s !== 'skipped'))('shows a %s job in Review or Applications, so no job drops out of sight', (status) => {
    expect(listed.has(status)).toBe(true);
  });
});
