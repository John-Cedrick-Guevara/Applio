import { describe, expect, it } from 'vitest';
import { runLine, runResult } from './run-summary';

describe('runLine', () => {
  it('summarizes the last run', () => {
    const at = new Date(2026, 10, 3, 8, 0).toISOString();
    expect(runLine({ at, found: 62, newAfterDedup: 47, passedFilters: 9, drafted: 4 }))
      .toBe('Last scan 08:00 · 62 found · 47 new · 9 passed filters · 4 drafted');
  });

  it('says when every source was at its daily poll limit, instead of 0 found', () => {
    const at = new Date(2026, 10, 3, 8, 0).toISOString();
    expect(runLine({ at, found: 0, newAfterDedup: 0, passedFilters: 0, drafted: 0, atLimit: 8 }))
      .toBe("Last scan 08:00 · every source has used today's polls; they poll again tomorrow");
  });

  it('notes sources at their limit alongside what the others found', () => {
    const at = new Date(2026, 10, 3, 8, 0).toISOString();
    expect(runLine({ at, found: 5, newAfterDedup: 5, passedFilters: 1, drafted: 0, atLimit: 1 }))
      .toBe("Last scan 08:00 · 5 found · 5 new · 1 passed filters · 0 drafted · 1 source at today's limit");
  });

  it('handles a fresh install', () => {
    expect(runLine(undefined)).toBe('No scans yet. Find jobs to fill the queue.');
  });
});

describe('runResult', () => {
  const at = '2026-11-07T08:00:00.000Z';
  it('says what a run produced', () => {
    expect(runResult({ at, found: 62, newAfterDedup: 47, passedFilters: 9, drafted: 4 })).toBe('Scan finished: 9 jobs passed your filters, 4 drafted.');
  });
  it('counts the jobs waiting on the operator\'s answers', () => {
    expect(runResult({ at, found: 62, newAfterDedup: 47, passedFilters: 9, drafted: 3, asked: 1 })).toBe('Scan finished: 9 jobs passed your filters, 3 drafted. 1 needs your answers in Review.');
  });

  it('says plainly when nothing passed', () => {
    expect(runResult({ at, found: 62, newAfterDedup: 47, passedFilters: 0, drafted: 0 })).toBe('Scan finished: nothing new passed your filters.');
  });
  it('says when the sources had no polls left', () => {
    expect(runResult({ at, found: 0, newAfterDedup: 0, passedFilters: 0, drafted: 0, atLimit: 8 })).toBe("Nothing was fetched: every source has used today's polls. They poll again tomorrow.");
  });
});
