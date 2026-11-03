import { describe, expect, it } from 'vitest';
import type { Preferences } from '../../../shared/types';
import { fromDraft, groupFacts, parseList, toDraft } from './preferences-model';

const prefs: Preferences = {
  targetRoles: ['Backend Engineer', 'Platform Engineer'], seniority: 'Mid to Senior', employmentTypes: ['full-time'],
  remoteOnly: true, hoursOverlap: '4h with UTC−5 to UTC+2', minimumPay: '[Your minimum] / year',
};

describe('parseList', () => {
  it('splits on commas and drops blanks', () => {
    expect(parseList(' a, b ,, c ')).toEqual(['a', 'b', 'c']);
  });
});

describe('preferences draft', () => {
  it('round-trips through the editable form', () => {
    expect(fromDraft(toDraft(prefs), prefs)).toEqual({ ok: true, value: prefs });
  });

  it('requires at least one target role', () => {
    expect(fromDraft({ ...toDraft(prefs), roles: ' , ' }, prefs)).toEqual({ ok: false, error: expect.stringMatching(/at least one role/) });
  });
});

describe('groupFacts', () => {
  it('groups facts in profile order and skips empty groups', () => {
    const groups = groupFacts(
      [{ name: 'A', dates: '2022 – now' }, { name: 'B' }, { name: 'C' }],
      [
        { id: '1', group: 'B', text: 'b1', tags: [], timesUsed: 0 },
        { id: '2', group: 'A', text: 'a1', tags: [], timesUsed: 3 },
        { id: '3', group: 'A', text: 'a2', tags: [], timesUsed: 1 },
      ],
    );
    expect(groups.map((g) => [g.name, g.meta, g.facts.length])).toEqual([['A', '2022 – now · 2 facts', 2], ['B', '1 fact', 1]]);
  });
});
