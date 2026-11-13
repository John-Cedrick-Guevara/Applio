import { describe, expect, it } from 'vitest';
import type { Job } from '../../../shared/types';
import { bucketOf, draftEstimate, matchRows, staleMatches, tabCounts, trashedAt } from './matches-model';

const LAST = '2026-11-13T08:00:00.000Z';
const job = (id: string, score: number | undefined, over: Partial<Job> = {}): Job => ({
  id, sourceId: 's', sourceName: 'Remotive', company: `Co ${id}`, title: `Role ${id}`, url: '', location: '', employmentType: 'full-time',
  postedAt: '', status: score === undefined ? 'found' : 'scored', channel: 'email', description: '', tags: [], strengths: [], gaps: [], applyTarget: '',
  factsUsed: 0, tokensUsed: 0, history: [{ status: 'found', at: '2026-11-12T08:00:00.000Z' }], ...(score === undefined ? {} : { score }), ...over,
});
const jobs = [
  job('a', 82, { history: [{ status: 'found', at: LAST }] }),
  job('b', 40),
  job('c', undefined, { history: [{ status: 'found', at: LAST }] }),
  job('d', 60, { title: 'Backend Engineer', company: 'Seaward' }),
  job('e', 91),
];
const base = { bar: 60, tab: 'all' as const, query: '', onlyNew: false, lastRunAt: LAST, drafting: [] as string[] };

describe('matchRows', () => {
  it('sorts best score first with unscored last', () => {
    expect(matchRows(jobs, base).map((j) => j.id)).toEqual(['e', 'a', 'd', 'b', 'c']);
  });

  it('leaves out jobs being drafted', () => {
    expect(matchRows(jobs, { ...base, drafting: ['e'] }).map((j) => j.id)).not.toContain('e');
  });

  it('buckets by the draft bar, the bar itself counting as at or above', () => {
    expect(matchRows(jobs, { ...base, tab: 'strong' }).map((j) => j.id)).toEqual(['e', 'a', 'd']);
    expect(matchRows(jobs, { ...base, tab: 'below' }).map((j) => j.id)).toEqual(['b']);
    expect(matchRows(jobs, { ...base, tab: 'unscored' }).map((j) => j.id)).toEqual(['c']);
  });

  it('searches role and company, ignoring case', () => {
    expect(matchRows(jobs, { ...base, query: 'seaWARD' }).map((j) => j.id)).toEqual(['d']);
    expect(matchRows(jobs, { ...base, query: 'backend' }).map((j) => j.id)).toEqual(['d']);
  });

  it('keeps jobs new since the last scan', () => {
    expect(matchRows(jobs, { ...base, onlyNew: true }).map((j) => j.id)).toEqual(['a', 'c']);
  });

  it('treats nothing as new before the first scan', () => {
    expect(matchRows(jobs, { ...base, onlyNew: true, lastRunAt: undefined })).toEqual([]);
  });
});

describe('tabCounts', () => {
  it('counts every tab under the same search and new filter', () => {
    expect(tabCounts(jobs, base)).toEqual({ strong: 3, below: 1, unscored: 1, all: 5, trash: 0 });
    expect(tabCounts(jobs, { ...base, onlyNew: true })).toEqual({ strong: 1, below: 0, unscored: 1, all: 2, trash: 0 });
  });
});

describe('draftEstimate', () => {
  const status = { tokensToday: 62_000, dailyTokenBudget: 150_000 };

  it("estimates a selection against what's left today", () => {
    expect(draftEstimate([jobs[0]!, jobs[3]!], status)).toEqual({ draftable: 2, leftOut: 0, cost: 60_000, left: 88_000 });
  });

  it('refuses a selection over budget, saying how many fit', () => {
    const est = draftEstimate([jobs[0]!, jobs[1]!, jobs[3]!], status);
    expect(est.block).toBe("About 90k tokens is more than the 88k left today. Pick 2 or fewer, or raise the budget.");
  });

  it('refuses any draft once the budget is used up', () => {
    expect(draftEstimate([jobs[0]!], { ...status, budgetStop: "Today's Claude token budget is used up." }).block).toBe("Today's Claude token budget is used up.");
  });

  it('leaves unscored jobs out of the draft count', () => {
    expect(draftEstimate([jobs[0]!, jobs[2]!], status)).toMatchObject({ draftable: 1, leftOut: 1, cost: 30_000 });
  });
});

describe('the Trash', () => {
  const trashed = (id: string, over: Partial<Job> = {}) => job(id, 70, { status: 'skipped', ...over });
  const mixed = [job('a', 82), trashed('t1'), trashed('t2')];

  it('lists skipped jobs only under the Trash tab, and keeps them out of every other tab', () => {
    expect(matchRows(mixed, { ...base, tab: 'trash' }).map((j) => j.id).sort()).toEqual(['t1', 't2']);
    for (const tab of ['all', 'strong', 'below', 'unscored'] as const) {
      expect(matchRows(mixed, { ...base, tab }).map((j) => j.id)).not.toContain('t1');
    }
  });

  it('counts the Trash on its own, leaving the other counts alone', () => {
    expect(tabCounts(mixed, base)).toEqual({ strong: 1, below: 0, unscored: 0, all: 1, trash: 2 });
  });

  it('files a skipped job under trash, whatever its score', () => {
    expect(bucketOf(trashed('t', { score: 99 }), 60)).toBe('trash');
  });

  it('lets the new and search filters apply inside the Trash too', () => {
    expect(matchRows(mixed, { ...base, tab: 'trash', query: 'role t2' }).map((j) => j.id)).toEqual(['t2']);
  });
});

describe('staleMatches', () => {
  const DAY = 86_400_000;
  const NOW = Date.parse('2026-11-30T12:00:00.000Z');
  const seen = (daysAgo: number) => [{ status: 'found' as const, at: new Date(NOW - daysAgo * DAY).toISOString() }];
  const old = job('old', 80, { history: seen(20) });
  const fresh = job('fresh', 80, { history: seen(2) });
  const weak = job('weak', 30, { history: seen(2) });
  const unscoredOld = job('unscoredOld', undefined, { history: seen(30) });
  const all = [old, fresh, weak, unscoredOld];
  const rule = { olderOn: true, olderDays: 14, belowOn: true, bar: 60, drafting: [] as string[], now: NOW };

  it('counts each rule on its own, and lists a job once even when both apply', () => {
    const both = job('both', 30, { history: seen(40) });
    const result = staleMatches([...all, both], rule);
    expect(result.older.map((j) => j.id).sort()).toEqual(['both', 'old', 'unscoredOld']);
    expect(result.below.map((j) => j.id).sort()).toEqual(['both', 'weak']);
    expect(result.picked.map((j) => j.id).sort()).toEqual(['both', 'old', 'unscoredOld', 'weak']);
  });

  it('picks only what the switched-on rules name', () => {
    expect(staleMatches(all, { ...rule, belowOn: false }).picked.map((j) => j.id).sort()).toEqual(['old', 'unscoredOld']);
    expect(staleMatches(all, { ...rule, olderOn: false }).picked.map((j) => j.id)).toEqual(['weak']);
    expect(staleMatches(all, { ...rule, olderOn: false, belowOn: false }).picked).toEqual([]);
  });

  it('only ever picks found or scored matches', () => {
    const skipped = job('s', 10, { status: 'skipped', history: seen(90) });
    const drafted = job('d', 10, { status: 'drafted', history: seen(90) });
    expect(staleMatches([skipped, drafted], rule).picked).toEqual([]);
  });

  it('leaves out jobs being drafted', () => {
    expect(staleMatches(all, { ...rule, drafting: ['old'] }).picked.map((j) => j.id)).not.toContain('old');
  });

  it('counts age from when the job was first seen, to the day', () => {
    const edge = job('edge', 80, { history: seen(14) });
    expect(staleMatches([edge], rule).picked.map((j) => j.id)).toEqual(['edge']);
    expect(staleMatches([job('almost', 80, { history: seen(13.5) })], rule).picked).toEqual([]);
  });
});

describe('trashedAt and old Trash', () => {
  const DAY = 86_400_000;
  const NOW = Date.parse('2026-11-30T12:00:00.000Z');
  const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
  const trashedJob = (id: string, daysAgo: number) => job(id, 50, { status: 'skipped', history: [{ status: 'found', at: at(90) }, { status: 'skipped', at: at(daysAgo) }, { status: 'skipped', at: at(daysAgo - 1) }] });

  it('is when the job was skipped, not a later note', () => {
    expect(trashedAt(trashedJob('t', 40))).toBe(at(40));
  });

  it('hides jobs trashed more than 30 days ago unless asked, counting them either way', () => {
    const jobs = [trashedJob('recent', 5), trashedJob('older', 45)];
    const f = { ...base, tab: 'trash' as const, now: NOW };
    expect(matchRows(jobs, f).map((j) => j.id)).toEqual(['recent']);
    expect(matchRows(jobs, { ...f, showOldTrash: true }).map((j) => j.id).sort()).toEqual(['older', 'recent']);
    expect(tabCounts(jobs, f).trash).toBe(2);
  });
});
