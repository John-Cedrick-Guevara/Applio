import { describe, expect, it } from 'vitest';
import { nextStatuses } from './status';

describe('nextStatuses', () => {
  it('lets a draft be approved or skipped', () => {
    expect(nextStatuses('drafted')).toEqual(['approved', 'skipped']);
  });

  it('follows the reply → interview → outcome flow', () => {
    expect(nextStatuses('applied')).toEqual(['replied', 'interview', 'rejected', 'ghosted']);
    expect(nextStatuses('interview')).toEqual(['offer', 'rejected']);
  });

  it('has no moves out of terminal states', () => {
    expect(nextStatuses('offer')).toEqual([]);
    expect(nextStatuses('skipped')).toEqual([]);
  });
});
