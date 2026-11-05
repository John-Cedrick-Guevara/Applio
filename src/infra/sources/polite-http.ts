import type { HttpGet } from '../../core/jobs/source';
import { AppError } from '../../shared/errors';

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

/** A job source couldn't be reached or refused the request; the runner records it and skips the source. */
export class SourceUnavailableError extends AppError {
  constructor(message: string) {
    super('SOURCE_UNAVAILABLE', message);
  }
}

interface Options {
  fetch: FetchLike;
  sleep: (ms: number) => Promise<void>;
  /** 0–1; spreads retries so many clients don't retry in step. */
  random: () => number;
  userAgent: string;
  /** Exact hostnames sources may reach over https. Everything else is refused before any request. */
  allowedHosts: readonly string[];
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;
const MAX_RETRY_AFTER_MS = 60_000;

/** Seconds or an HTTP date → milliseconds to wait, capped so one board can't stall a run. */
const retryAfterMs = (header: string | null): number | undefined => {
  if (!header) return undefined;
  const ms = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now();
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS) : undefined;
};

/**
 * HTTP for job sources, polite by construction (SPEC F2): a descriptive
 * User-Agent, conditional requests with ETag / Last-Modified, backoff with
 * jitter on 429 and 5xx, one request at a time per source, and https only
 * to an allowlist of hosts — so no adapter can reach LinkedIn, Indeed,
 * JobStreet or Upwork (SPEC §1).
 * ponytail: the revalidation cache is in memory; the first poll after a restart is a full fetch.
 */
export function createPoliteHttp({ fetch, sleep, random, userAgent, allowedHosts }: Options) {
  const cache = new Map<string, { etag?: string; lastModified?: string; body: string }>();
  const queues = new Map<string, Promise<unknown>>();

  const fetchText = async (url: string): Promise<string> => {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:' || !allowedHosts.includes(hostname)) {
      throw new SourceUnavailableError(`${hostname} isn't an allowed job source`);
    }
    const cached = cache.get(url);
    const headers: Record<string, string> = { 'user-agent': userAgent, accept: 'application/json, application/rss+xml, text/xml;q=0.9, */*;q=0.8' };
    if (cached?.etag) headers['if-none-match'] = cached.etag;
    if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified;

    let last = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let res: Response | undefined;
      try {
        res = await fetch(url, { headers });
      } catch (err) {
        last = err instanceof Error ? err.message : String(err);
      }
      if (res?.status === 304 && cached) return cached.body;
      if (res?.ok) {
        const body = await res.text();
        cache.set(url, { etag: res.headers.get('etag') ?? undefined, lastModified: res.headers.get('last-modified') ?? undefined, body });
        return body;
      }
      if (res && res.status !== 429 && res.status < 500) throw new SourceUnavailableError(`${hostname} answered HTTP ${res.status}`);
      if (res) last = `HTTP ${res.status}`;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryAfterMs(res?.headers.get('retry-after') ?? null) ?? BASE_DELAY_MS * 2 ** attempt * (0.5 + random()));
      }
    }
    throw new SourceUnavailableError(`${hostname} is unavailable (${last} after ${MAX_ATTEMPTS} tries)`);
  };

  return {
    /** A client for one source; its requests run one after another. */
    forSource(sourceId: string): HttpGet {
      const serial = <T>(task: () => Promise<T>): Promise<T> => {
        const run = (queues.get(sourceId) ?? Promise.resolve()).then(task, task);
        queues.set(sourceId, run.catch(() => undefined));
        return run;
      };
      return {
        getText: (url) => serial(() => fetchText(url)),
        getJson: (url) => serial(async () => JSON.parse(await fetchText(url)) as unknown),
      };
    },
  };
}
