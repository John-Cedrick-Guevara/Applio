import { describe, expect, it } from 'vitest';
import { seedJobs } from '../../shared/mock/fixtures';
import type { Job } from '../../shared/types';
import { folderFor, jobIdIn, jobMarkdown, safeName } from './application-folder';

const NOW = new Date(2026, 10, 6, 9, 0);
const job = { ...(seedJobs(NOW)[0] as Job), id: 'j42', company: 'Acme: AI/ML 🚀', title: 'Senior Engineer', score: 88 };

describe('application folder', () => {
  it.each([
    ['Acme: AI/ML 🚀', 'Acme AI-ML'],
    ['  ..Hidden. ', 'Hidden'],
    ['A<b>c*d?e|f"g\\h', 'Abcdefg-h'],
    ['x'.repeat(100), 'x'.repeat(60)],
  ])('makes %j safe for a file name: %j', (raw, safe) => {
    expect(safeName(raw)).toBe(safe);
  });

  it('files each application under its month, company, role and score', () => {
    expect(folderFor(job, NOW)).toBe('2026-11/Acme AI-ML — Senior Engineer (88%)');
  });

  it('writes the job with its id in front matter, the board credited, and the posting kept verbatim', () => {
    const md = jobMarkdown(job);
    expect(md.startsWith('---\napplio_job_id: j42\n')).toBe(true);
    expect(md).toContain(`Found on ${job.sourceName}: ${job.url}`);
    expect(md).toContain(job.description);
    expect(jobIdIn(md)).toBe('j42');
  });

  it('finds no id in a file Applio did not write', () => {
    expect(jobIdIn('# Notes\nnothing here')).toBeUndefined();
  });
});
