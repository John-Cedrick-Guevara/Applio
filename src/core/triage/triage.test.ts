import { describe, expect, it } from 'vitest';
import type { Preferences } from '../../shared/types';
import { dedupKey } from './dedup';
import { discovered } from './test-jobs';
import { triage } from './triage';

const prefs: Preferences = {
  targetRoles: ['Backend Engineer', 'Platform Engineer'], seniority: '', employmentTypes: ['full-time', 'contract'],
  remoteOnly: true, hoursOverlap: 'At least 4h with UTC−5 to UTC+2', minimumPay: '$90k / year',
};
const run = (jobs: ReturnType<typeof discovered>[], opts: { existing?: string[]; blocklist?: string[]; preferences?: Partial<Preferences> } = {}) =>
  triage(jobs, { existingKeys: new Set(opts.existing ?? []), preferences: { ...prefs, ...opts.preferences }, blocklist: opts.blocklist ?? [] });

describe('triage prefilter', () => {
  it('keeps a title with every word of one target role, in any order and spelling', () => {
    const { passed } = run([discovered({ title: 'Senior Back-end Developer (Node.js)' }), discovered({ company: 'B', title: 'Engineer, Platform' })]);
    expect(passed).toHaveLength(2);
  });

  it('drops a title missing a word of every target role', () => {
    const { passed, report } = run([discovered({ title: 'Sales Engineer' })]);
    expect(passed).toEqual([]);
    expect(report.dropped.role).toBe(1);
  });

  it('lets every title through when no target roles are set', () => {
    expect(run([discovered({ title: 'Sales Engineer' })], { preferences: { targetRoles: [] } }).passed).toHaveLength(1);
  });

  it('drops an on-site job when remote-only is set, and keeps one whose board says nothing', () => {
    const { passed, report } = run([discovered({ remote: false }), discovered({ company: 'B', remote: undefined })]);
    expect(passed.map((j) => j.company)).toEqual(['B']);
    expect(report.dropped.remote).toBe(1);
    expect(run([discovered({ remote: false })], { preferences: { remoteOnly: false } }).passed).toHaveLength(1);
  });

  it('drops an unwanted employment type, and keeps a job with none given', () => {
    const { passed, report } = run([discovered({ employmentType: 'freelance' }), discovered({ company: 'B', employmentType: undefined })]);
    expect(passed.map((j) => j.company)).toEqual(['B']);
    expect(report.dropped.type).toBe(1);
  });

  it('drops a job paying below the minimum, and keeps one whose pay is unreadable', () => {
    const { passed, report } = run([discovered({ salary: '$60k–80k' }), discovered({ company: 'B', salary: 'Competitive' })]);
    expect(passed.map((j) => j.company)).toEqual(['B']);
    expect(report.dropped.pay).toBe(1);
  });

  it('drops a job whose hours can never overlap, and keeps one with no hours given', () => {
    const { passed, report } = run([discovered({ location: 'Remote (UTC+9 to UTC+10)' }), discovered({ company: 'B', location: 'Worldwide' })]);
    expect(passed.map((j) => j.company)).toEqual(['B']);
    expect(report.dropped.hours).toBe(1);
  });

  it('drops blocklisted companies, ignoring case and legal suffixes', () => {
    const { passed, report } = run([discovered({ company: 'INITECH, Inc.' }), discovered({ company: 'Acme' })], { blocklist: ['initech'] });
    expect(passed.map((j) => j.company)).toEqual(['Acme']);
    expect(report.dropped.blocklist).toBe(1);
  });
});

describe('seniority rule', () => {
  it('drops senior-and-up titles for an entry-level operator, keeping junior ones', () => {
    const { passed, report } = run(
      [discovered({ title: 'Senior Backend Engineer' }), discovered({ company: 'B', title: 'Junior Backend Engineer' }), discovered({ company: 'C', title: 'Staff Platform Engineer' })],
      { preferences: { seniority: 'Entry level' } },
    );
    expect(passed.map((j) => j.title)).toEqual(['Junior Backend Engineer']);
    expect(report.dropped.seniority).toBe(2);
  });

  it('keeps a title that names both levels, like "Senior/Junior"', () => {
    expect(run([discovered({ title: 'Backend Engineer (junior to senior)' })], { preferences: { seniority: 'Entry level' } }).passed).toHaveLength(1);
  });

  it('drops only staff-and-up for a mid-level operator', () => {
    const { passed } = run([discovered({ title: 'Senior Backend Engineer' }), discovered({ company: 'B', title: 'Principal Backend Engineer' })], { preferences: { seniority: 'Mid level' } });
    expect(passed.map((j) => j.title)).toEqual(['Senior Backend Engineer']);
  });

  it('drops nothing for seniority when none is set', () => {
    expect(run([discovered({ title: 'Principal Backend Engineer' })]).passed).toHaveLength(1);
  });
});

describe('location rule', () => {
  const ph = (jobs: ReturnType<typeof discovered>[]) => triage(jobs, { existingKeys: new Set(), preferences: prefs, blocklist: [], homeLocation: 'Marikina, Philippines' });

  it('drops a job limited to regions that leave the operator out', () => {
    const { passed, report } = ph([discovered({ location: 'Remote (US only)' }), discovered({ company: 'B', location: 'Czechia, Hungary, Slovakia' }), discovered({ company: 'C', location: 'REMOTE (EEA)' })]);
    expect(passed).toEqual([]);
    expect(report.dropped.location).toBe(3);
  });

  it.each(['Worldwide', 'Anywhere in the World', 'Not specified', 'Remote', 'Philippines', 'Remote (APAC-friendly)', 'Berlin', 'REMOTE (Europe, Africa, W Asia)'])('keeps a job located %j: worldwide, the operator\'s own region, or unreadable', (location) => {
    expect(ph([discovered({ location })]).passed).toHaveLength(1);
  });

  it('reads a region named in the title, which boards often use instead of the location', () => {
    expect(ph([discovered({ title: 'Senior Backend Engineer - EU', location: 'Anywhere in the World' })]).report.dropped.location).toBe(1);
  });

  it("skips the rule when the operator's own country can't be read", () => {
    expect(triage([discovered({ location: 'USA' })], { existingKeys: new Set(), preferences: prefs, blocklist: [], homeLocation: 'Open to remote' }).passed).toHaveLength(1);
  });
});

describe('role match', () => {
  it.each([
    ['SEO and Web Dev Specialist', 'Web Developer'],
    ['QA Engineer – Backend & Frontend', 'Back-end Engineer'],
    ['Software Engineer Interviewer', 'Software Engineer'],
  ])('does not match %j to the target %j', (title, role) => {
    expect(run([discovered({ title })], { preferences: { targetRoles: [role] } }).report.dropped.role).toBe(1);
  });

  it.each([
    ['AI/Automation Engineer', 'AI Engineer'],
    ['Backend Engineer, Payments', 'Backend Engineer'],
    ['Software Development Engineer II - CRM', 'Software Engineer'],
    ['Mechatronics Engineer, AI Engineer', 'AI Engineer'],
    ['Software Engineer Infrastructure', 'Software Engineer'],
  ])('matches %j to the target %j', (title, role) => {
    expect(run([discovered({ title })], { preferences: { targetRoles: [role] } }).passed).toHaveLength(1);
  });
});

describe('triage report', () => {
  it('counts what was found, merged, dropped per reason and passed', () => {
    const { report, passed } = run(
      [
        discovered({ company: 'Keep' }),
        discovered({ company: 'Keep', sourceId: 'remoteok' }),
        discovered({ company: 'Old' }),
        discovered({ company: 'Sales', title: 'Sales Engineer' }),
        discovered({ company: 'Onsite', remote: false }),
        discovered({ company: 'Blocked' }),
      ],
      { existing: [dedupKey({ company: 'Old', title: 'Senior Backend Engineer' })], blocklist: ['blocked'] },
    );
    expect(passed.map((j) => j.company)).toEqual(['Keep']);
    expect(report).toEqual({
      found: 6, duplicates: 2, passed: 1,
      dropped: { blocklist: 1, type: 0, remote: 1, role: 1, seniority: 0, location: 0, pay: 0, hours: 0 },
    });
  });

  it('gives each passed job its dedup key, for storing', () => {
    const [job] = run([discovered()]).passed;
    expect(job?.dedupKey).toBe(dedupKey(discovered()));
  });
});
