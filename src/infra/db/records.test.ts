// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { seedDrafts, seedJobs, seedSources } from '../../shared/mock/fixtures';
import type { Draft, Job, Source } from '../../shared/types';
import { openDatabase } from './database';
import { createActivityRepo } from './activity';
import { createDraftsRepo } from './drafts';
import { createJobsRepo } from './jobs';
import { createSettingsRepo } from './settings';
import { createSourcesRepo } from './sources';

const NOW = new Date('2026-11-04T09:00:00.000Z');

describe('drafts repository', () => {
  const setup = () => {
    const db = openDatabase(':memory:');
    const jobs = seedJobs(NOW);
    const draft = seedDrafts(jobs, NOW)[0] as Draft;
    createJobsRepo(db).insert(jobs.find((j) => j.id === draft.jobId) as Job, { dedupKey: 'k', createdAt: NOW.toISOString() });
    return { drafts: createDraftsRepo(db), draft };
  };

  it('reads back a draft with its résumé sections and answers', () => {
    const { drafts, draft } = setup();
    drafts.save(draft);
    expect(drafts.get(draft.jobId)).toEqual(draft);
  });

  it('replaces the draft for the same job when saved again', () => {
    const { drafts, draft } = setup();
    drafts.save(draft);
    drafts.save({ ...draft, coverLetter: 'Edited', edited: true });
    expect(drafts.get(draft.jobId)).toEqual({ ...draft, coverLetter: 'Edited', edited: true });
  });

  it('refuses a draft for a job that does not exist', () => {
    const { drafts, draft } = setup();
    expect(() => drafts.save({ ...draft, jobId: 'missing' })).toThrow();
  });
});

describe('sources repository', () => {
  const [board, clip] = seedSources(NOW) as [Source, Source, ...Source[]];

  it('lists sources in the order first saved and updates them in place', () => {
    const sources = createSourcesRepo(openDatabase(':memory:'));
    sources.save(board);
    sources.save(clip);
    sources.save({ ...board, enabled: !board.enabled });
    expect(sources.list()).toEqual([{ ...board, enabled: !board.enabled }, clip]);
    expect(sources.get(clip.id)).toEqual(clip);
    expect(sources.get('missing')).toBeUndefined();
  });
});

describe('settings repository', () => {
  it('stores any JSON value per key and returns undefined for unset keys', () => {
    const settings = createSettingsRepo(openDatabase(':memory:'));
    settings.set('draftThreshold', 75);
    settings.set('assistedFill', { platform: false, custom: true });
    settings.set('draftThreshold', 80);
    expect(settings.get('draftThreshold')).toBe(80);
    expect(settings.all()).toEqual({ draftThreshold: 80, assistedFill: { platform: false, custom: true } });
    expect(settings.get('missing')).toBeUndefined();
  });
});

describe('activity repository', () => {
  it('returns the latest run summary', () => {
    const activity = createActivityRepo(openDatabase(':memory:'));
    expect(activity.latestRun()).toBeUndefined();
    activity.addRun({ at: '2026-11-04T06:00:00.000Z', found: 10, newAfterDedup: 8, passedFilters: 4, drafted: 2 });
    activity.addRun({ at: '2026-11-04T12:00:00.000Z', found: 5, newAfterDedup: 1, passedFilters: 1, drafted: 0 });
    expect(activity.latestRun()).toEqual({ at: '2026-11-04T12:00:00.000Z', found: 5, newAfterDedup: 1, passedFilters: 1, drafted: 0 });
  });

  it('totals recorded tokens by step since a given time', () => {
    const activity = createActivityRepo(openDatabase(':memory:'));
    activity.recordUsage({ at: '2026-11-03T23:00:00.000Z', step: 'score', tokens: 999 });
    activity.recordUsage({ at: '2026-11-04T08:00:00.000Z', step: 'score', tokens: 100, jobId: 'j1' });
    activity.recordUsage({ at: '2026-11-04T09:00:00.000Z', step: 'score', tokens: 50 });
    activity.recordUsage({ at: '2026-11-04T09:30:00.000Z', step: 'tailor', tokens: 400, jobId: 'j1' });
    expect(activity.tokensByStep('2026-11-04T00:00:00.000Z')).toEqual([
      { step: 'score', tokens: 150 },
      { step: 'tailor', tokens: 400 },
    ]);
  });

  it('stores a run with its drop counts and source outcomes', () => {
    const activity = createActivityRepo(openDatabase(':memory:'));
    const details = { duplicates: 2, dropped: { blocklist: 0, type: 0, remote: 1, role: 3, pay: 0, hours: 0 }, sources: [{ sourceId: 'remotive', outcome: 'ok' as const, jobs: 6, dropped: 0 }] };
    activity.addRun({ at: '2026-11-04T06:00:00.000Z', found: 6, newAfterDedup: 4, passedFilters: 0, drafted: 0 }, details);
    expect(activity.latestRunDetails()).toEqual(details);
  });

  it("replaces a run's details once scoring is done", () => {
    const activity = createActivityRepo(openDatabase(':memory:'));
    const base = { duplicates: 0, dropped: { blocklist: 0, type: 0, remote: 0, role: 0, pay: 0, hours: 0 }, sources: [] };
    const id = activity.addRun({ at: '2026-11-06T06:00:00.000Z', found: 1, newAfterDedup: 1, passedFilters: 1, drafted: 0 }, base);
    activity.updateDetails(id, { ...base, scoring: { scored: 1, toDraft: ['j1'], belowThreshold: 0, notScored: 0 } }, 1);
    expect(activity.latestRunDetails()?.scoring).toEqual({ scored: 1, toDraft: ['j1'], belowThreshold: 0, notScored: 0 });
    expect(activity.latestRun()?.drafted).toBe(1);
  });

  it('totals all tokens since a given time', () => {
    const activity = createActivityRepo(openDatabase(':memory:'));
    expect(activity.tokensSince('2026-11-04T00:00:00.000Z')).toBe(0);
    activity.recordUsage({ at: '2026-11-03T23:00:00.000Z', step: 'score', tokens: 999 });
    activity.recordUsage({ at: '2026-11-04T08:00:00.000Z', step: 'score', tokens: 100 });
    activity.recordUsage({ at: '2026-11-04T09:30:00.000Z', step: 'tailor', tokens: 400 });
    expect(activity.tokensSince('2026-11-04T00:00:00.000Z')).toBe(500);
  });

  it('keeps input and output tokens apart on each usage record', () => {
    const db = openDatabase(':memory:');
    createActivityRepo(db).recordUsage({ at: '2026-11-04T08:00:00.000Z', step: 'score', tokens: 140, inputTokens: 100, outputTokens: 40, runId: 3, jobId: 'j1' });
    expect(db.prepare('SELECT step, tokens, input_tokens, output_tokens, run_id, job_id FROM usage_records').get()).toEqual({
      step: 'score', tokens: 140, input_tokens: 100, output_tokens: 40, run_id: 3, job_id: 'j1',
    });
  });
});
