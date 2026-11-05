// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { seedJobs } from '../../shared/mock/fixtures';
import type { Job } from '../../shared/types';
import { openDatabase } from './database';
import { createJobsRepo } from './jobs';

const NOW = new Date('2026-11-04T09:00:00.000Z');
const [first, second] = seedJobs(NOW) as [Job, Job, ...Job[]];

const setup = () => createJobsRepo(openDatabase(':memory:'));

describe('jobs repository', () => {
  it('reads back a job with its full history exactly as written', () => {
    const jobs = setup();
    jobs.insert(first, { dedupKey: 'k1', createdAt: NOW.toISOString() });
    expect(jobs.get(first.id)).toEqual(first);
  });

  it('returns undefined for an unknown job', () => {
    expect(setup().get('missing')).toBeUndefined();
  });

  it('finds a job by its dedup key', () => {
    const jobs = setup();
    jobs.insert(first, { dedupKey: 'acme|engineer', createdAt: NOW.toISOString() });
    expect(jobs.findByDedupKey('acme|engineer')?.id).toBe(first.id);
    expect(jobs.findByDedupKey('other')).toBeUndefined();
  });

  it('lists every stored dedup key, whatever the status', () => {
    const jobs = setup();
    jobs.insert({ ...first, status: 'applied' }, { dedupKey: 'acme|engineer', createdAt: NOW.toISOString() });
    jobs.insert(second, { dedupKey: 'globex|designer', createdAt: NOW.toISOString() });
    expect(jobs.dedupKeys()).toEqual(new Set(['acme|engineer', 'globex|designer']));
  });

  it('lists jobs in the given statuses, newest first', () => {
    const jobs = setup();
    jobs.insert({ ...first, status: 'drafted' }, { dedupKey: 'k1', createdAt: '2026-11-01T00:00:00.000Z' });
    jobs.insert({ ...second, status: 'drafted' }, { dedupKey: 'k2', createdAt: '2026-11-02T00:00:00.000Z' });
    jobs.insert({ ...first, id: 'other', status: 'skipped' }, { dedupKey: 'k3', createdAt: '2026-11-03T00:00:00.000Z' });
    expect(jobs.list({ statuses: ['drafted'] }).map((j) => j.id)).toEqual([second.id, first.id]);
    expect(jobs.list()).toHaveLength(3);
  });

  it('moves a job to a new status and appends that event to its history', () => {
    const jobs = setup();
    jobs.insert(first, { dedupKey: 'k1', createdAt: NOW.toISOString() });
    const event = { status: 'skipped' as const, at: '2026-11-04T10:00:00.000Z', note: 'not a fit' };
    const moved = jobs.transition(first.id, event);
    expect(moved.status).toBe('skipped');
    expect(moved.history.at(-1)).toEqual(event);
    expect(jobs.get(first.id)).toEqual(moved);
  });

  it('writes nothing when any part of an insert fails', () => {
    const jobs = setup();
    const badHistory = [...first.history, { status: 'applied', at: null }] as unknown as Job['history'];
    expect(() => jobs.insert({ ...first, history: badHistory }, { dedupKey: 'k1', createdAt: NOW.toISOString() })).toThrow();
    expect(jobs.get(first.id)).toBeUndefined();
    expect(jobs.list()).toEqual([]);
  });

  it('stores text with quotes and SQL keywords verbatim', () => {
    const jobs = setup();
    const company = `O'Brien"; DROP TABLE jobs; --`;
    jobs.insert({ ...first, company }, { dedupKey: `x' OR '1'='1`, createdAt: NOW.toISOString() });
    expect(jobs.get(first.id)?.company).toBe(company);
    expect(jobs.findByDedupKey(`x' OR '1'='1`)?.id).toBe(first.id);
  });
});
