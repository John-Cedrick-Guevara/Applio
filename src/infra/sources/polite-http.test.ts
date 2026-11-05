// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createPoliteHttp, type FetchLike } from './polite-http';

const ok = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers });
const status = (code: number, headers: Record<string, string> = {}) => new Response(null, { status: code, headers });

/** A fetch that answers from a queue and records each request. */
const fakeFetch = (...answers: (Response | Error)[]) => {
  const calls: { url: string; headers: Headers }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    const next = answers.shift();
    if (!next) throw new Error('no more fake answers');
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetch, calls };
};

const setup = (fetch: FetchLike) => {
  const sleep = vi.fn(async (_ms: number) => {});
  const http = createPoliteHttp({ fetch, sleep, random: () => 0.5, userAgent: 'Applio/test', allowedHosts: ['example.com', 'api.example.org'] });
  return { http, sleep };
};

describe('polite HTTP client', () => {
  it('sends a descriptive User-Agent', async () => {
    const { fetch, calls } = fakeFetch(ok('{"a":1}'));
    expect(await setup(fetch).http.forSource('s').getJson('https://example.com/api')).toEqual({ a: 1 });
    expect(calls[0]!.headers.get('user-agent')).toBe('Applio/test');
  });

  it('revalidates with ETag and Last-Modified, and reuses the cached body on 304', async () => {
    const { fetch, calls } = fakeFetch(ok('{"v":1}', { etag: '"abc"', 'last-modified': 'Thu, 05 Nov 2026 08:00:00 GMT' }), status(304));
    const source = setup(fetch).http.forSource('s');
    await source.getJson('https://example.com/api');
    expect(await source.getJson('https://example.com/api')).toEqual({ v: 1 });
    expect(calls[1]!.headers.get('if-none-match')).toBe('"abc"');
    expect(calls[1]!.headers.get('if-modified-since')).toBe('Thu, 05 Nov 2026 08:00:00 GMT');
  });

  it('waits as long as Retry-After asks on 429, then retries', async () => {
    const { fetch } = fakeFetch(status(429, { 'retry-after': '7' }), ok('[]'));
    const { http, sleep } = setup(fetch);
    expect(await http.forSource('s').getJson('https://example.com/api')).toEqual([]);
    expect(sleep).toHaveBeenCalledWith(7000);
  });

  it('backs off with jitter on server errors and gives up after three tries', async () => {
    const { fetch, calls } = fakeFetch(status(503), status(502), status(500));
    const { http, sleep } = setup(fetch);
    await expect(http.forSource('s').getJson('https://example.com/api')).rejects.toThrow('example.com is unavailable (HTTP 500 after 3 tries)');
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000]);
  });

  it('retries a network failure the same way', async () => {
    const { fetch } = fakeFetch(new TypeError('fetch failed'), ok('[]'));
    expect(await setup(fetch).http.forSource('s').getJson('https://example.com/api')).toEqual([]);
  });

  it('does not retry other client errors', async () => {
    const { fetch, calls } = fakeFetch(status(404));
    await expect(setup(fetch).http.forSource('s').getJson('https://example.com/api')).rejects.toThrow('example.com answered HTTP 404');
    expect(calls).toHaveLength(1);
  });

  it('never runs two requests for one source at the same time', async () => {
    let inFlight = 0;
    let most = 0;
    const fetch: FetchLike = async () => {
      most = Math.max(most, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return ok('[]');
    };
    const source = setup(fetch).http.forSource('s');
    await Promise.all([source.getJson('https://example.com/a'), source.getJson('https://example.com/b')]);
    expect(most).toBe(1);
  });

  it.each(['https://www.linkedin.com/jobs', 'https://indeed.com/q', 'https://www.jobstreet.com/', 'https://www.upwork.com/nx/search', 'https://evil.example.com.attacker.net/'])(
    'refuses a host outside the allowlist: %s',
    async (url) => {
      const { fetch, calls } = fakeFetch(ok('[]'));
      await expect(setup(fetch).http.forSource('s').getJson(url)).rejects.toThrow(/isn't an allowed job source/);
      expect(calls).toHaveLength(0);
    },
  );

  it('refuses plain http', async () => {
    const { fetch } = fakeFetch(ok('[]'));
    await expect(setup(fetch).http.forSource('s').getJson('http://example.com/api')).rejects.toThrow(/isn't an allowed job source/);
  });

  it('runs in a test setup where real network calls fail', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow(/Tests must not use the network/);
  });
});
