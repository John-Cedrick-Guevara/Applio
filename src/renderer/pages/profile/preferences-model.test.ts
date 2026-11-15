import { describe, expect, it } from 'vitest';
import type { Preferences } from '../../../shared/types';
import { defaultCurrency, factFilterCounts, filterSections, fromDraft, groupFacts, parseList, payNeedsDetail, readPay, toDraft } from './preferences-model';

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
    const result = fromDraft({ ...toDraft(prefs), payAmount: '30000', payCurrency: 'PHP', payPeriod: 'month', payTouched: true }, prefs);
    expect(result).toMatchObject({ ok: true, value: { minimumPay: '30,000 PHP / month' } });
  });

  it('saves no minimum when the amount is empty', () => {
    expect(fromDraft({ ...toDraft(prefs), payAmount: ' ', payTouched: true }, prefs)).toMatchObject({ ok: true, value: { minimumPay: '' } });
  });

  it('refuses an amount that is not a number', () => {
    expect(fromDraft({ ...toDraft(prefs), payAmount: 'thirty', payTouched: true }, prefs)).toEqual({ ok: false, error: 'Enter the minimum pay as a number, e.g. 30000.' });
  });

  it('requires at least one target role', () => {
    expect(fromDraft({ ...toDraft(prefs), roles: ' , ' }, prefs)).toEqual({ ok: false, error: expect.stringMatching(/at least one role/) });
  });
});

describe('minimum pay', () => {
  it('keeps a saved minimum exactly as it was when the pay fields are not touched', () => {
    const withAlternatives = { ...prefs, minimumPay: '$120k / year or $45 / hour' };
    const draft = { ...toDraft(withAlternatives), roles: 'Backend Engineer' };
    expect(fromDraft(draft, withAlternatives)).toMatchObject({ ok: true, value: { minimumPay: '$120k / year or $45 / hour' } });
  });

  it('reads only the first of several alternatives, with its own period', () => {
    expect(readPay('$120k / year or $45 / hour')).toEqual({ amount: '120000', currency: 'USD', period: 'year' });
  });

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

describe('fact filters', () => {
  const groups = [
    { name: 'Job', kind: 'experience' as const }, { name: 'App', kind: 'project' as const },
    { name: 'Tools', kind: 'skills' as const }, { name: 'Misc' },
  ];
  const fact = (id: string, group: string) => ({ id, group, text: id, tags: [], timesUsed: 0 });
  const sections = groupFacts(groups, [fact('1', 'Job'), fact('2', 'Job'), fact('3', 'App'), fact('4', 'Tools'), fact('5', 'Misc')]);

  it('shows every section under All, including ones with no kind', () => {
    expect(filterSections(sections, 'all').map((s) => s.name)).toEqual(['Job', 'App', 'Tools', 'Misc']);
  });

  it('shows only sections of the chosen kind', () => {
    expect(filterSections(sections, 'experience').map((s) => s.name)).toEqual(['Job']);
    expect(filterSections(sections, 'project').map((s) => s.name)).toEqual(['App']);
    expect(filterSections(sections, 'skills').map((s) => s.name)).toEqual(['Tools']);
  });

  it('counts facts per filter, with skill chips added to Skills and All', () => {
    expect(factFilterCounts(sections, ['Node', 'Go'])).toEqual({ all: 7, experience: 2, project: 1, skills: 3 });
  });
});
