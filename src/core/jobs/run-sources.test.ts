import { describe, expect, it, vi } from 'vitest';
import type { DiscoveredJob, HttpGet, JobSource } from './source';
import { localDay, runSources, type PollCounter } from './run-sources';

const job = (sourceId: string, n: number): DiscoveredJob => ({
  sourceId, sourceName: sourceId, externalId: `${sourceId}-${n}`, company: 'Acme', title: 'Engineer', boardUrl: 'https://example.com/j',
  applyUrl: 'https://example.com/j', description: 'Build things', location: 'Remote', postedAt: '2026-11-05T00:00:00.000Z', tags: [],
});

const source = (id: string, fetchJobs: JobSource['fetchJobs'], dailyPollLimit = 4): JobSource => ({ id, name: id, dailyPollLimit, hosts: [], fetchJobs });
const returning = (id: string, count: number, dropped = 0) => source(id, vi.fn(async () => ({ jobs: Array.from({ length: count }, (_, i) => job(id, i)), dropped })));

/** Poll counts in memory, keyed by source and day, like the SQLite repository. */
const memoryPolls = (): PollCounter & { counts: Map<string, number> } => {
  const counts = new Map<string, number>();
  return {
    counts,
    count: (id, day) => counts.get(`${id}|${day}`) ?? 0,
    record: (id, day) => void counts.set(`${id}|${day}`, (counts.get(`${id}|${day}`) ?? 0) + 1),
  };
};

const http: HttpGet = { getJson: async () => null, getText: async () => '' };
const run = (sources: JobSource[], opts: { enabled?: string[]; polls?: PollCounter; day?: string } = {}) =>
  runSources({
    sources,
    isEnabled: (id) => (opts.enabled ?? sources.map((s) => s.id)).includes(id),
    polls: opts.polls ?? memoryPolls(),
    httpFor: () => http,
    today: () => opts.day ?? '2026-11-05',
  });

describe('runSources', () => {
  it('collects jobs from every enabled source and reports each outcome', async () => {
    const result = await run([returning('a', 2), returning('b', 1, 3)]);
    expect(result.jobs.map((j) => j.externalId)).toEqual(['a-0', 'a-1', 'b-0']);
    expect(result.sources).toEqual([
      { sourceId: 'a', outcome: 'ok', jobs: 2, dropped: 0 },
      { sourceId: 'b', outcome: 'ok', jobs: 1, dropped: 3 },
    ]);
  });

  it('never contacts a disabled source', async () => {
    const off = returning('off', 1);
    const result = await run([returning('on', 1), off], { enabled: ['on'] });
    expect(off.fetchJobs).not.toHaveBeenCalled();
    expect(result.sources[1]).toEqual({ sourceId: 'off', outcome: 'disabled', jobs: 0, dropped: 0 });
  });

  it('counts each poll and skips a source at its daily limit until the next day', async () => {
    const polls = memoryPolls();
    const limited = returning('a', 1);
    limited.dailyPollLimit = 2;
    await run([limited], { polls });
    await run([limited], { polls });
    const third = await run([limited], { polls });
    expect(third.sources[0]).toEqual({ sourceId: 'a', outcome: 'limit', jobs: 0, dropped: 0 });
    expect(limited.fetchJobs).toHaveBeenCalledTimes(2);

    const nextDay = await run([limited], { polls, day: '2026-11-06' });
    expect(nextDay.sources[0]?.outcome).toBe('ok');
  });

  it('records a failing source and still finishes the others', async () => {
    const broken = source('broken', async () => {
      throw new Error('remotive.com is unavailable (HTTP 503 after 3 tries)');
    });
    const result = await run([broken, returning('fine', 2)]);
    expect(result.jobs).toHaveLength(2);
    expect(result.sources[0]).toEqual({ sourceId: 'broken', outcome: 'failed', jobs: 0, dropped: 0, error: 'remotive.com is unavailable (HTTP 503 after 3 tries)' });
  });

  it('counts a failed poll against the limit, so a broken board is not hammered', async () => {
    const polls = memoryPolls();
    await run([source('broken', async () => Promise.reject(new Error('down')))], { polls });
    expect(polls.count('broken', '2026-11-05')).toBe(1);
  });
});

describe('localDay', () => {
  it('uses the local calendar date, not UTC', () => {
    expect(localDay(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05');
    expect(localDay(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });
});
