import { describe, expect, it } from 'vitest';
import { seedDrafts, seedJobs } from '../mock/fixtures';
import type { Draft, Job } from '../types';
import { DOC_CSS, documentNames, letterBody, pageHtml, resumeBody, signOff } from './application-documents';

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

/** A draft in the locked layout: each section names the fact-bank section it draws from. */
const owner = {
  name: 'John Cedrick Guevara', email: 'john@example.com',
  contact: {
    phone: '+63 954 115 2016', location: 'Philippines • Open to Remote', education: 'BS Computer Science', notes: '',
    links: [{ label: 'Portfolio', url: 'https://guevix.com' }, { label: 'GitHub', url: 'https://github.com/jc' }],
  },
  groups: [
    { name: 'AI Developer — Afterhours PH', kind: 'experience' as const, dates: 'Jun 2026 – Oct 2026', context: 'AI support SaaS; 12+ tenants.' },
    { name: 'Octivia', kind: 'project' as const, dates: 'Solo build', link: 'https://octavia.guevix.com', context: 'Multi-tenant AI platform. LangChain, Next.js.' },
    { name: 'Languages', kind: 'skills' as const },
    { name: 'Certifications & Achievements', kind: 'certifications' as const },
  ],
};
const strategist: Draft = {
  ...draft,
  headline: 'AI Engineer',
  summary: 'AI engineer shipping production LLM systems for 12+ tenants.',
  resume: [
    { heading: 'Certifications & Achievements', group: 'Certifications & Achievements', items: [{ text: 'Top 10 Finalist, Inventi Hackathon 2025', factId: 'c1' }] },
    { heading: 'Languages', group: 'Languages', items: [{ text: 'TypeScript, Python, SQL', factId: 's1' }] },
    { heading: 'Octivia', group: 'Octivia', items: [{ text: 'Blocks hallucinated prices with server-side guardrails.', factId: 'p1' }] },
    { heading: 'AI Developer — Afterhours PH', group: 'AI Developer — Afterhours PH', items: [{ text: 'Reduced reply latency from 20s to 6s.', factId: 'e1' }] },
  ],
};

describe('locked résumé layout', () => {
  const html = resumeBody(strategist, owner);
  const at = (s: string) => html.indexOf(s);

  it('puts the header first: name in capitals, title line, contact line, then labelled links', () => {
    expect(html).toMatch(/^<div class="strategist"><h1 class="name">JOHN CEDRICK GUEVARA<\/h1><p class="title">AI Engineer<\/p>/);
    expect(html).toContain('<p class="contact">Philippines • Open to Remote • +63 954 115 2016 • john@example.com</p>');
    expect(html).toContain('<a href="https://guevix.com">Portfolio</a> • <a href="https://github.com/jc">GitHub</a>');
  });

  it('orders the sections Summary, Experience, Projects, Technical Skills, Certifications, Education, whatever order the draft used', () => {
    const order = ['>SUMMARY<', '>EXPERIENCE<', '>PROJECTS<', '>TECHNICAL SKILLS<', '>CERTIFICATIONS &amp; ACHIEVEMENTS<', '>EDUCATION<'].map(at);
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('prints role, dates and context from the fact bank, with the dates on the same line', () => {
    expect(html).toContain('<div class="entry-head"><strong>AI Developer — Afterhours PH</strong><span class="dates">Jun 2026 – Oct 2026</span></div><p class="context">AI support SaaS; 12+ tenants.</p><ul><li>Reduced reply latency from 20s to 6s.</li></ul>');
  });

  it('heads a project "Name | link | Solo build" with the link as its label', () => {
    expect(html).toContain('<div class="entry-head"><span><strong>Octivia</strong> | <a href="https://octavia.guevix.com">octavia.guevix.com</a> | Solo build</span></div>');
  });

  it('lists skills by group, and education without anything Claude wrote', () => {
    expect(html).toContain('<p><strong>Languages:</strong> TypeScript, Python, SQL</p>');
    expect(html).toContain('<h2>EDUCATION</h2><p>BS Computer Science</p></div>');
  });

  it('stays one column of real text: no tables, images or scripts', () => {
    expect(html).not.toMatch(/<(table|img|svg|script|iframe)/);
  });

  it('prints in Times on A4 with half-inch margins', () => {
    const page = pageHtml(html, 'Resume');
    expect(page).toContain('size:A4');
    expect(page).toContain('margin:12.7mm');
    expect(page).toContain(`<div class="applio-doc">${html}</div>`);
    expect(DOC_CSS).toMatch(/\.strategist\{font-family:"Times New Roman",Times,serif;font-size:10pt/);
  });

  it('keeps an older draft in the old layout', () => {
    expect(resumeBody(draft, who)).toContain('<h1>Sam Rivera</h1>');
  });
});

describe('letter sign-off and file names', () => {
  it('signs off with name, then phone and first link', () => {
    expect(signOff(owner)).toBe('John Cedrick Guevara\n+63 954 115 2016 | guevix.com');
    expect(letterBody({ ...strategist, coverLetter: 'Hello team.' }, job, owner)).toContain('<p>John Cedrick Guevara<br>+63 954 115 2016 | guevix.com</p>');
  });

  it('names the files by last name and role, safe for any file system', () => {
    expect(documentNames('John Cedrick Guevara', 'AI Engineer')).toEqual({ resume: 'Guevara_AI_Engineer.pdf', letter: 'Guevara_AI_Engineer_Cover_Letter.pdf' });
    expect(documentNames('Sam Rivera', 'Full-Stack Developer / AI (Remote)')).toEqual({ resume: 'Rivera_Full-Stack_Developer_AI_Remote.pdf', letter: 'Rivera_Full-Stack_Developer_AI_Remote_Cover_Letter.pdf' });
    expect(documentNames('', 'AI Engineer').resume).toBe('AI_Engineer.pdf');
  });
});

