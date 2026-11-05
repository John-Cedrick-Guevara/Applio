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
      dropped: { blocklist: 1, type: 0, remote: 1, role: 1, pay: 0, hours: 0 },
    });
  });

  it('gives each passed job its dedup key, for storing', () => {
    const [job] = run([discovered()]).passed;
    expect(job?.dedupKey).toBe(dedupKey(discovered()));
  });
});
