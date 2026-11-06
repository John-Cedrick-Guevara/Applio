import { describe, expect, it } from 'vitest';
import { seedDrafts, seedJobs } from '../mock/fixtures';
import type { Draft, Job } from '../types';
import { DOC_CSS, letterBody, pageHtml, resumeBody } from './application-documents';

const NOW = new Date('2026-11-06T09:00:00.000Z');
const jobs = seedJobs(NOW);
const draft = seedDrafts(jobs, NOW)[0] as Draft;
const job = jobs.find((j) => j.id === draft.jobId) as Job;
const who = { name: 'Sam Rivera', email: 'sam@example.com' };

describe('application documents', () => {
  it('lay the resume out as one plain column with standard headings, every line from the draft', () => {
    const html = resumeBody(draft, who);
    expect(html).toContain('<h1>Sam Rivera</h1>');
    expect(html).toContain('sam@example.com');
    for (const section of draft.resume) {
      expect(html).toContain(`<h2>${section.heading}</h2>`);
      for (const item of section.items) expect(html).toContain(`<li>${item.text}</li>`);
    }
    expect(html).not.toMatch(/<(table|img|svg|script)/);
  });

  it('escape everything, since drafts are shaped by job postings', () => {
    const hostile = { ...draft, headline: '<script>alert(1)</script>', resume: [{ heading: 'A & B', items: [{ text: '<img src=x onerror=alert(1)>', factId: 'f' }] }] };
    const html = resumeBody(hostile, who);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('A &amp; B');
  });

  it('write the letter as paragraphs under the name, addressed to the company', () => {
    const html = letterBody({ ...draft, coverLetter: 'Hello team,\n\nI build APIs.' }, job, who);
    expect(html).toContain('<p>Hello team,</p><p>I build APIs.</p>');
    expect(html).toContain(job.company);
  });

  it('leave the name out rather than invent one when it is not set', () => {
    expect(resumeBody(draft, { name: '', email: '' })).not.toContain('<h1>');
  });

  it('print the same markup the preview shows, with the one stylesheet', () => {
    const body = resumeBody(draft, who);
    const page = pageHtml(body, 'Resume');
    expect(page).toContain(`<div class="applio-doc">${body}</div>`);
    expect(page).toContain(DOC_CSS);
    expect(page).toMatch(/^<!doctype html>/);
  });
});
