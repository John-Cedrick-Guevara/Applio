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
});
