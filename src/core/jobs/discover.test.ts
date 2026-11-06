import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFERENCES } from '../../shared/defaults';
import type { Job } from '../../shared/types';
import { discovered } from '../triage/test-jobs';
import { discover, type DiscoverPorts, type RunDetails } from './discover';
import type { RunSourcesResult } from './run-sources';

const NOW = new Date('2026-11-05T06:00:00.000Z');

const setup = (polled: RunSourcesResult, existing: string[] = [], targetRoles = ['Backend Engineer']) => {
  const saved: { jobs: { job: Job; dedupKey: string }[]; details: RunDetails }[] = [];
  const scoring: { runId: number; details: RunDetails }[] = [];
  const score = vi.fn(async (ids: readonly string[]) => ({ scored: ids.length, toDraft: [...ids], belowThreshold: 0, notScored: 0 }));
  let n = 0;
  const poll = vi.fn(async () => polled);
  const ports: DiscoverPorts = {
    poll,
    existingKeys: () => new Set(existing),
    filters: () => ({ preferences: { ...DEFAULT_PREFERENCES, targetRoles }, blocklist: ['Evil Corp'] }),
    save: (jobs, details) => (saved.push({ jobs, details }), 42),
    score,
    saveScoring: (runId, details) => void scoring.push({ runId, details }),
    now: () => NOW,
    newId: () => `id-${++n}`,
  };
  return { run: () => discover(ports), saved, poll, score, scoring };
};

const ok = (sourceId: string, jobs: number) => ({ sourceId, outcome: 'ok' as const, jobs, dropped: 0 });

describe('discover', () => {
  const polled: RunSourcesResult = {
    jobs: [
      discovered({ externalId: 'a', company: 'Acme', title: 'Senior Backend Engineer', applyUrl: 'https://jobs.lever.co/acme/1' }),
      discovered({ externalId: 'b', sourceId: 'remoteok', company: 'Acme, Inc.', title: 'Sr. Back-end Engineer' }),
      discovered({ externalId: 'c', company: 'Evil Corp', title: 'Backend Engineer' }),
      discovered({ externalId: 'd', company: 'Globex', title: 'Sales Manager' }),
    ],
    sources: [ok('remotive', 3), ok('remoteok', 1)],
  };

  it('returns the run summary: found, new after dedup, passed filters, nothing drafted yet', async () => {
    expect(await setup(polled).run()).toEqual({ at: NOW.toISOString(), found: 4, newAfterDedup: 3, passedFilters: 1, drafted: 0 });
  });

  it('saves the jobs that pass as found, with their channel and board link', async () => {
    const { run, saved } = setup(polled);
    await run();
    const [entry] = saved[0]!.jobs;
    expect(entry!.dedupKey).toBe('acme|senior backend engineer');
    expect(entry!.job).toMatchObject({
      id: 'id-1', company: 'Acme', title: 'Senior Backend Engineer', status: 'found', channel: 'ats', applyTarget: 'jobs.lever.co',
      url: 'https://remotive.com/j/1', sourceName: 'Remotive', history: [{ status: 'found', at: NOW.toISOString() }],
    });
  });

  it('stores the drop counts and each source outcome with the run', async () => {
    const { run, saved } = setup(polled);
    await run();
    expect(saved[0]!.details).toEqual({
      duplicates: 1,
      dropped: { blocklist: 1, type: 0, remote: 0, role: 1, pay: 0, hours: 0 },
      sources: polled.sources,
    });
  });

  it('never saves a job Applio already has', async () => {
    const { run, saved } = setup(polled, ['acme|senior backend engineer']);
    expect((await run()).passedFilters).toBe(0);
    expect(saved[0]!.jobs).toEqual([]);
  });

  it('records a run whose sources all failed, with each failure', async () => {
    const failed = { sourceId: 'remotive', outcome: 'failed' as const, jobs: 0, dropped: 0, error: 'remotive.com is unavailable (HTTP 503 after 3 tries)' };
    const { run, saved } = setup({ jobs: [], sources: [failed] });
    expect(await run()).toMatchObject({ found: 0, passedFilters: 0 });
    expect(saved[0]!.details.sources).toEqual([failed]);
  });

  it("scores the run's new jobs against the run, then stores the result with it", async () => {
    const { run, score, scoring } = setup(polled);
    await run();
    expect(score).toHaveBeenCalledWith(['id-1'], 42);
    expect(scoring[0]).toMatchObject({ runId: 42, details: { scoring: { scored: 1, toDraft: ['id-1'], belowThreshold: 0, notScored: 0 } } });
  });

  it('keeps the run when scoring fails as a whole, and records why', async () => {
    const { run, score, scoring } = setup(polled);
    score.mockRejectedValueOnce(new Error('database is locked'));
    expect(await run()).toMatchObject({ passedFilters: 1 });
    expect(scoring[0]!.details.scoringError).toBe('database is locked');
  });

  it('polls nothing and saves nothing until a target role is set, so unfiltered jobs never pile up', async () => {
    const { run, saved, poll } = setup(polled, [], []);
    await expect(run()).rejects.toThrow('Add at least one target role in Profile, then run discovery again.');
    expect(poll).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });
});
