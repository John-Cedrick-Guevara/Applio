// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HttpGet } from '../../core/jobs/source';
import { createAtsWatchlist, type WatchEntry } from './ats-watchlist';
import { hackerNews } from './hacker-news';
import { weWorkRemotely } from './weworkremotely';

const raw = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');

/** Answers by URL pattern from recorded fixtures, remembering every URL asked for; unknown URLs fail like a 404. */
const routes = (table: [RegExp, string][]) => {
  const urls: string[] = [];
  const answer = (url: string) => {
    urls.push(url);
    const hit = table.find(([re]) => re.test(url));
    if (!hit) throw new Error(`${new URL(url).hostname} answered HTTP 404`);
    return raw(hit[1]);
  };
  const http: HttpGet = { getText: async (url) => answer(url), getJson: async (url) => JSON.parse(answer(url)) };
  return { http, urls };
};

describe('We Work Remotely (RSS)', () => {
  const run = () => weWorkRemotely.fetchJobs(routes([[/weworkremotely\.com\/remote-jobs\.rss$/, 'wwr.rss']]).http);

  it('reads each feed item into the shared job shape, splitting "Company: Role"', async () => {
    const { jobs, dropped } = await run();
    expect(dropped).toBe(0);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      sourceId: 'wwr', sourceName: 'We Work Remotely', company: 'Welltech', title: 'Product Growth Manager (Acquisition Funnels)',
      boardUrl: 'https://weworkremotely.com/remote-jobs/welltech-product-growth-manager-acquisition-funnels',
      location: 'Anywhere in the World', postedAt: '2026-11-05T06:51:49.000Z', employmentType: 'full-time', remote: true, tags: ['Sales and Marketing'],
    });
  });

  it('turns the entity-encoded HTML description into plain text', async () => {
    const { jobs } = await run();
    expect(jobs[0]!.description).toContain('Headquarters: Bulgaria');
    for (const job of jobs) expect(job.description).not.toMatch(/<[a-z/][^>]*>|&lt;|&amp;/i);
  });
});

describe('HN Who is hiring (Algolia)', () => {
  const recorded = () =>
    routes([
      [/hn\.algolia\.com\/api\/v1\/search_by_date\?tags=story,author_whoishiring/, 'hn-search.json'],
      [/hn\.algolia\.com\/api\/v1\/items\/50338728$/, 'hn-items.json'],
    ]);

  it("fetches this month's thread and offers each top-level comment as a job", async () => {
    const { http, urls } = recorded();
    const { jobs } = await hackerNews.fetchJobs(http);
    expect(urls).toHaveLength(2);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({
      sourceId: 'hn', sourceName: 'HN Who is hiring', externalId: expect.any(String), company: 'Simple Analytics', title: 'DevOps Engineer',
      remote: true, boardUrl: expect.stringMatching(/^https:\/\/news\.ycombinator\.com\/item\?id=\d+$/),
    });
    expect(jobs[0]!.description).toMatch(/^Simple Analytics \| DevOps Engineer/);
  });

  it('reads ONSITE posts as not remote', async () => {
    const { jobs } = await hackerNews.fetchJobs(recorded().http);
    expect(jobs.find((j) => j.company.startsWith('University of Cambridge'))?.remote).toBe(false);
  });

  it('polls at most once a day, since the thread is monthly', () => {
    expect(hackerNews.dailyPollLimit).toBe(1);
  });
});

describe('ATS watchlist', () => {
  const ats = (list: WatchEntry[]) => createAtsWatchlist(() => list);
  const recorded = () =>
    routes([
      [/boards-api\.greenhouse\.io\/v1\/boards\/gitlab\/jobs\?content=true$/, 'greenhouse.json'],
      [/api\.lever\.co\/v0\/postings\/leverdemo\?mode=json$/, 'lever.json'],
      [/api\.ashbyhq\.com\/posting-api\/job-board\/ashby\?includeCompensation=true$/, 'ashby.json'],
      [/apply\.workable\.com\/api\/v1\/widget\/accounts\/huggingface$/, 'workable.json'],
    ]);

  it('makes no request while the watchlist is empty', async () => {
    const { http, urls } = recorded();
    expect(await ats([]).fetchJobs(http)).toEqual({ jobs: [], dropped: 0 });
    expect(urls).toEqual([]);
  });

  it.each([
    { entry: { ats: 'greenhouse', slug: 'gitlab' }, sourceName: 'Greenhouse', first: { company: 'GitLab', title: 'AI Transformation Owner, CRO', location: 'Remote, United States', remote: true, boardUrl: 'https://job-boards.greenhouse.io/gitlab/jobs/8638232002' } },
    { entry: { ats: 'lever', slug: 'leverdemo' }, sourceName: 'Lever', first: { company: 'leverdemo', title: 'Customer Success Manager', location: 'Atlanta, Georgia', remote: false, employmentType: 'full-time', salary: 'USD 85,000–175,000' } },
    { entry: { ats: 'ashby', slug: 'ashby' }, sourceName: 'Ashby', first: { company: 'ashby', title: 'Engineering Manager - EU', location: 'Remote - European Union', remote: true, salary: '€150K – €250K • Offers Equity • Offers Bonus' } },
    { entry: { ats: 'workable', slug: 'huggingface' }, sourceName: 'Workable', first: { company: 'Hugging Face', title: 'Open-Source Machine Learning Engineer - EMEA Remote', location: 'Paris, France', remote: true, employmentType: 'full-time', boardUrl: 'https://apply.workable.com/j/81B46579FE' } },
  ] as const)("reads $entry.ats boards into the shared job shape", async ({ entry, sourceName, first }) => {
    const { jobs, dropped } = await ats([entry]).fetchJobs(recorded().http);
    expect(dropped).toBe(0);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ sourceId: 'ats', sourceName, ...first });
    for (const job of jobs) expect(job.description.length).toBeGreaterThan(0);
  });

  it('keeps the other companies when one board is missing, and notes which one failed', async () => {
    const { jobs, notes } = await ats([{ ats: 'lever', slug: 'gone' }, { ats: 'greenhouse', slug: 'gitlab' }]).fetchJobs(recorded().http);
    expect(jobs).toHaveLength(2);
    expect(notes).toEqual(['lever/gone: api.lever.co answered HTTP 404']);
  });

  it('fails the source when every company fails, so the run records it', async () => {
    await expect(ats([{ ats: 'lever', slug: 'gone' }]).fetchJobs(recorded().http)).rejects.toThrow('lever/gone: api.lever.co answered HTTP 404');
  });

  it('only contacts the four ATS hosts', () => {
    expect([...ats([]).hosts].sort()).toEqual(['api.ashbyhq.com', 'api.lever.co', 'apply.workable.com', 'boards-api.greenhouse.io']);
  });
});
