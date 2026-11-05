// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSources } from '../../core/jobs/run-sources';
import { createPollsRepo, openDatabase } from '../db';
import { DEFAULT_SOURCES } from '../../shared/defaults';
import { createAllSources, createPoliteHttp, JSON_BOARDS, SOURCE_HOSTS, type FetchLike } from './index';

const FIXTURE_FOR_HOST: Record<string, string> = {
  'remoteok.com': 'remoteok', 'remotive.com': 'remotive', 'himalayas.app': 'himalayas', 'jobicy.com': 'jobicy', 'www.arbeitnow.com': 'arbeitnow',
};

/** Serves each board's recorded response by host, and records which hosts were asked. */
const recordedBoards = () => {
  const hosts: string[] = [];
  const fetch: FetchLike = async (url) => {
    const host = new URL(url).hostname;
    hosts.push(host);
    return new Response(readFileSync(join(__dirname, 'fixtures', `${FIXTURE_FOR_HOST[host]}.json`), 'utf8'), { status: 200 });
  };
  return { fetch, hosts };
};

describe('discovery over the JSON boards', () => {
  it('polls only enabled boards through the polite client and counts each poll in SQLite', async () => {
    const { fetch, hosts } = recordedBoards();
    const http = createPoliteHttp({ fetch, sleep: async () => {}, random: () => 0.5, userAgent: 'Applio/test', allowedHosts: SOURCE_HOSTS });
    const polls = createPollsRepo(openDatabase(':memory:'));
    const result = await runSources({
      sources: JSON_BOARDS,
      isEnabled: (id) => id !== 'jobicy',
      polls,
      httpFor: (s) => http.forSource(s.id),
      today: () => '2026-11-05',
    });

    expect(hosts.sort()).toEqual(['himalayas.app', 'remoteok.com', 'remotive.com', 'www.arbeitnow.com']);
    expect(result.jobs).toHaveLength(12);
    expect(result.sources.map((s) => `${s.sourceId}:${s.outcome}`)).toEqual(['remoteok:ok', 'remotive:ok', 'himalayas:ok', 'jobicy:disabled', 'arbeitnow:ok']);
    expect(polls.count('remotive', '2026-11-05')).toBe(1);
    expect(polls.count('jobicy', '2026-11-05')).toBe(0);
  });

  it('allows exactly the hosts of the sources Applio polls', () => {
    expect([...SOURCE_HOSTS].sort()).toEqual([
      'api.ashbyhq.com', 'api.lever.co', 'apply.workable.com', 'boards-api.greenhouse.io', 'himalayas.app', 'hn.algolia.com',
      'jobicy.com', 'remoteok.com', 'remotive.com', 'weworkremotely.com', 'www.arbeitnow.com',
    ]);
  });

  it('gives every polled source a matching default source in settings', () => {
    const ids = createAllSources(() => []).map((s) => s.id);
    expect(ids.filter((id) => !DEFAULT_SOURCES.some((d) => d.id === id))).toEqual([]);
  });

  it('allows no host of a platform Applio must never scrape', () => {
    expect(SOURCE_HOSTS.filter((h) => /linkedin|indeed|jobstreet|upwork/.test(h))).toEqual([]);
  });
});
