import { describe, expect, it } from 'vitest';
import { JOB_STATUSES } from '../../shared/status';
import { APPLICATION_STATUSES, REVIEW_STATUSES, TRASH_STATUSES } from './job-lists';

const listed = new Set<string>([...REVIEW_STATUSES, ...APPLICATION_STATUSES, ...TRASH_STATUSES]);

describe('job lists', () => {
  // A skipped job used to be the one status no screen showed, so a pasted duplicate pointed nowhere and a skip
  // couldn't be undone. The Trash lists it now, so there is no exemption.
  it.each(JOB_STATUSES)('shows a %s job in the Inbox or Matches, Applications, or the Trash, so no job drops out of sight', (status) => {
    expect(listed.has(status)).toBe(true);
  });

  it('keeps the Trash to skipped jobs, which Restore can bring back', () => {
    expect(TRASH_STATUSES).toEqual(['skipped']);
  });
});
