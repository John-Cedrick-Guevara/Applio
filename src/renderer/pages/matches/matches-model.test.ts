import { describe, expect, it } from 'vitest';
import type { Job } from '../../../shared/types';
import { draftEstimate, matchRows, tabCounts } from './matches-model';

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
    expect(tabCounts(jobs, base)).toEqual({ strong: 3, below: 1, unscored: 1, all: 5 });
    expect(tabCounts(jobs, { ...base, onlyNew: true })).toEqual({ strong: 1, below: 0, unscored: 1, all: 2 });
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
