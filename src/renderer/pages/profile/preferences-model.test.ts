import { describe, expect, it } from 'vitest';
import type { Preferences } from '../../../shared/types';
import { defaultCurrency, fromDraft, groupFacts, parseList, payNeedsDetail, readPay, toDraft } from './preferences-model';

const prefs: Preferences = {
  targetRoles: ['Backend Engineer', 'Platform Engineer'], seniority: 'Mid to Senior', employmentTypes: ['full-time'],
  remoteOnly: true, hoursOverlap: '4h with UTC−5 to UTC+2', minimumPay: '90,000 USD / year',
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

  it('saves work type and remote-only, which the filters use on the next run', () => {
    const result = fromDraft({ ...toDraft(prefs), types: ['contract', 'freelance'], remoteOnly: false }, prefs);
    expect(result).toMatchObject({ ok: true, value: { employmentTypes: ['contract', 'freelance'], remoteOnly: false } });
  });

  it('writes minimum pay with its currency and period, so it is never read as yearly dollars by accident', () => {
    const result = fromDraft({ ...toDraft(prefs), payAmount: '30000', payCurrency: 'PHP', payPeriod: 'month' }, prefs);
    expect(result).toMatchObject({ ok: true, value: { minimumPay: '30,000 PHP / month' } });
  });

  it('saves no minimum when the amount is empty', () => {
    expect(fromDraft({ ...toDraft(prefs), payAmount: ' ' }, prefs)).toMatchObject({ ok: true, value: { minimumPay: '' } });
  });

  it('refuses an amount that is not a number', () => {
    expect(fromDraft({ ...toDraft(prefs), payAmount: 'thirty' }, prefs)).toEqual({ ok: false, error: 'Enter the minimum pay as a number, e.g. 30000.' });
  });

  it('requires at least one target role', () => {
    expect(fromDraft({ ...toDraft(prefs), roles: ' , ' }, prefs)).toEqual({ ok: false, error: expect.stringMatching(/at least one role/) });
  });
});

describe('minimum pay', () => {
  it('reads a saved minimum back into amount, currency and period', () => {
    expect(readPay('30,000 PHP / month')).toEqual({ amount: '30000', currency: 'PHP', period: 'month' });
    expect(readPay('$45 / hour')).toEqual({ amount: '45', currency: 'USD', period: 'hour' });
  });

  it('flags a legacy minimum with no currency or period, so the operator picks them', () => {
    expect(payNeedsDetail('30,000')).toBe(true);
    expect(payNeedsDetail('30,000 PHP')).toBe(true);
    expect(payNeedsDetail('30,000 PHP / month')).toBe(false);
    expect(payNeedsDetail('')).toBe(false);
  });

  it("defaults the currency from the operator's location", () => {
    expect(defaultCurrency('Philippines • Open to Remote')).toBe('PHP');
    expect(defaultCurrency('Berlin, Germany')).toBe('EUR');
    expect(defaultCurrency('')).toBe('USD');
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
