import { describe, expect, it } from 'vitest';
import type { Preferences } from '../../shared/types';
import { REAL_JOBS } from './real-titles';
import { discovered } from './test-jobs';
import { triage } from './triage';

/** The operator's own filters at QA time (2026-11-07). */
const OPERATOR: Preferences = {
  targetRoles: ['AI engineer', 'Back-end Engineer', 'Full-stack Engineer', 'Forward Engineer', 'Software Engineer', 'Software Developer', 'AI developer', 'Web Developer'],
  seniority: 'Entry level', employmentTypes: ['full-time', 'contract', 'freelance'], remoteOnly: true, hoursOverlap: '', minimumPay: '',
};

const run = (jobs: typeof REAL_JOBS) =>
  triage(jobs.map((j, i) => discovered({ company: `Co${i}`, title: j.title, location: j.location })), {
    existingKeys: new Set(), preferences: OPERATOR, blocklist: [], homeLocation: 'Philippines • Open to Remote',
  });

describe('prefilter on the jobs Applio really found (QA 2026-11-07)', () => {
  it('drops at least half of the jobs the AI scored under 20, before any token is spent', () => {
    const weak = REAL_JOBS.filter((j) => j.score < 20);
    expect(run(weak).passed.length).toBeLessThanOrEqual(weak.length / 2);
  });

  it('keeps every job the AI scored 50 or more', () => {
    const strong = REAL_JOBS.filter((j) => j.score >= 50);
    expect(run(strong).passed.map((j) => j.title)).toEqual(strong.map((j) => j.title));
  });
});
