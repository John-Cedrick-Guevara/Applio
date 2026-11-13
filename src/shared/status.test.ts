import { describe, expect, it } from 'vitest';
import { nextStatuses, statusBeforeTrash } from './status';

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

describe('statusBeforeTrash', () => {
  it('is the last status that is not skipped, ignoring notes added while trashed', () => {
    expect(statusBeforeTrash([{ status: 'found' }, { status: 'scored' }, { status: 'skipped' }, { status: 'skipped' }])).toBe('scored');
  });

  it('falls back to found when nothing came before', () => {
    expect(statusBeforeTrash([{ status: 'skipped' }])).toBe('found');
  });
});
