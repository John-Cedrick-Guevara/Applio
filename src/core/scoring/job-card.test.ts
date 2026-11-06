import { describe, expect, it } from 'vitest';
import { essentialText, jobCard } from './job-card';

const POSTING = `About us
Acme is a fast-growing fintech on a mission to make billing delightful. We have offices in 4 countries.
The role
You will own our billing APIs and their latency.
Requirements:
- 5+ years of backend experience
- Node.js and PostgreSQL
Nice to have
- Redis
What we offer
- Unlimited PTO
- Home office budget
Equal Opportunity Employer
Acme is an equal opportunity employer and values diversity.`;

describe('essentialText', () => {
  it('keeps the role and its requirements and drops company, benefits and equal-opportunity sections', () => {
    expect(essentialText(POSTING)).toBe(`The role
You will own our billing APIs and their latency.
Requirements:
- 5+ years of backend experience
- Node.js and PostgreSQL
Nice to have
- Redis`);
  });

  it('keeps a posting without headings as it is, up to the cap', () => {
    expect(essentialText('Build APIs in Go.')).toBe('Build APIs in Go.');
    expect(essentialText('x'.repeat(5000))).toHaveLength(2501);
  });

  it("falls back to the start of the posting if everything looked like boilerplate", () => {
    expect(essentialText('About us\nWe build rockets.')).toBe('About us\nWe build rockets.');
  });
});

describe('jobCard', () => {
  it('carries what scoring needs and nothing else', () => {
    expect(jobCard({ id: 'j1', company: 'Acme', title: 'Backend Engineer', location: 'Remote', employmentType: 'full-time', salary: '$120k', tags: ['Node.js'], description: POSTING })).toEqual({
      id: 'j1', company: 'Acme', title: 'Backend Engineer', location: 'Remote', type: 'full-time', pay: '$120k', tags: ['Node.js'], posting: essentialText(POSTING),
    });
  });
});
