// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { HttpGet, JobSource } from '../../core/jobs/source';
import { JSON_BOARDS } from './index';

const fixture = (name: string): unknown => JSON.parse(readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf8'));

/** Answers every request with one recorded response, and remembers the URLs asked for. */
const replay = (body: unknown) => {
  const urls: string[] = [];
  const http: HttpGet = {
    getJson: async (url) => (urls.push(url), structuredClone(body)),
    getText: async () => {
      throw new Error('not used by JSON boards');
    },
  };
  return { http, urls };
};

const board = (id: string) => JSON_BOARDS.find((s) => s.id === id) as JobSource;

describe.each([
  {
    id: 'remoteok', name: 'Remote OK', host: 'remoteok.com',
    first: {
      externalId: '1137680', company: 'Destination Careers', title: 'Entry Level Scheduling & Coordinating Reservations Online',
      location: 'South Carolina', postedAt: '2026-11-04T00:00:06.000Z', remote: true,
    },
  },
  {
    id: 'remotive', name: 'Remotive', host: 'remotive.com',
    first: {
      externalId: '1749306', company: 'Coalition Technologies', title: 'Freelance Copywriter', boardUrl: 'https://remotive.com/remote-jobs/writing/freelance-copywriter-1749306',
      location: 'Worldwide', postedAt: '2026-11-02T20:01:00.000Z', salary: '$20k -$35k', employmentType: 'freelance', remote: true,
    },
  },
  {
    id: 'himalayas', name: 'Himalayas', host: 'himalayas.app',
    first: {
      externalId: 'https://himalayas.app/companies/swamp-ventures/jobs/product-management-contractor', company: 'Swamp Ventures', title: 'Product Management Contractor',
      applyUrl: 'https://himalayas.app/companies/swamp-ventures/jobs/product-management-contractor?utm_source=api', location: 'United States',
      postedAt: new Date(1793869281 * 1000).toISOString(), employmentType: 'contract', remote: true, utcOffsets: [-10, -9, -8, -7, -6, -5, 14],
    },
  },
  {
    id: 'jobicy', name: 'Jobicy', host: 'jobicy.com',
    first: {
      externalId: '159113', company: 'Cribl', title: 'Regional Sales Manager, Singapore', boardUrl: 'https://jobicy.com/jobs/159113-regional-sales-manager-singapore-2',
      applyUrl: 'https://jobicy.com/jobs/159113-regional-sales-manager-singapore-2', location: 'APAC', postedAt: '2026-11-05T05:44:53.000Z', employmentType: 'full-time', remote: true,
    },
  },
  {
    id: 'arbeitnow', name: 'Arbeitnow', host: 'www.arbeitnow.com',
    first: {
      externalId: 'senior-dynamics-365-consultant-berlin-92149', company: 'audius SE', title: 'Senior Dynamics 365 Consultant (m/w/d)',
      location: 'Berlin', postedAt: new Date(1793871055 * 1000).toISOString(), remote: true,
    },
  },
])('$name', ({ id, name, host, first }) => {
  it('normalizes the recorded response into the shared job shape', async () => {
    const { jobs, dropped } = await board(id).fetchJobs(replay(fixture(id)).http);
    expect(dropped).toBe(0);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]).toMatchObject({ sourceId: id, sourceName: name, ...first });
  });

  it('credits the board on every job with a link back to it, and keeps descriptions as plain text', async () => {
    const { jobs } = await board(id).fetchJobs(replay(fixture(id)).http);
    for (const job of jobs) {
      expect(job.sourceName).toBe(name);
      expect(new URL(job.boardUrl).hostname.toLowerCase()).toBe(host);
      expect(job.description).not.toMatch(/<[a-z/][^>]*>/i);
      expect(job.description.length).toBeGreaterThan(0);
    }
  });

  it('only contacts its own host', async () => {
    const { http, urls } = replay(fixture(id));
    await board(id).fetchJobs(http);
    expect(urls.map((u) => new URL(u).hostname)).toEqual([host]);
    expect(board(id).hosts).toEqual([host]);
  });
});

describe('JSON boards', () => {
  it('drop a malformed job, count it, and keep the rest', async () => {
    const body = fixture('remotive') as { jobs: unknown[] };
    body.jobs.splice(1, 0, { id: 'not-a-number', title: 42 });
    const { jobs, dropped } = await board('remotive').fetchJobs(replay(body).http);
    expect(dropped).toBe(1);
    expect(jobs).toHaveLength(3);
  });

  it("skip Remote OK's legal notice, which arrives as the first item", async () => {
    const { jobs, dropped } = await board('remoteok').fetchJobs(replay(fixture('remoteok')).http);
    expect(jobs.map((j) => j.externalId)).not.toContain(undefined);
    expect(dropped).toBe(0);
  });

  it("repair Remote OK's double-encoded UTF-8, which its API sends for accented text", async () => {
    const { jobs } = await board('remoteok').fetchJobs(replay(fixture('remoteok')).http);
    const vogel = jobs.find((j) => j.company === 'Vogel')!;
    expect(vogel.description).toContain('Tausende Häuser');
    expect(vogel.description).not.toMatch(/Ã|Â/);
  });

  it('mark an Arbeitnow job remote only when the board says so', async () => {
    const { jobs } = await board('arbeitnow').fetchJobs(replay(fixture('arbeitnow')).http);
    expect(jobs.map((j) => j.remote)).toEqual([true, true, false]);
  });

  it('respect a polite daily poll limit', () => {
    for (const source of JSON_BOARDS) expect(source.dailyPollLimit).toBeLessThanOrEqual(4);
  });
});
