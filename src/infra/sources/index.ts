import type { JobSource } from '../../core/jobs/source';
import { arbeitnow } from './arbeitnow';
import { createAtsWatchlist, type WatchEntry } from './ats-watchlist';
import { hackerNews } from './hacker-news';
import { himalayas } from './himalayas';
import { jobicy } from './jobicy';
import { remoteOk } from './remoteok';
import { remotive } from './remotive';
import { weWorkRemotely } from './weworkremotely';

export { createPoliteHttp, SourceUnavailableError, type FetchLike } from './polite-http';
export type { AtsPlatform, WatchEntry } from './ats-watchlist';

/** The public JSON boards. */
export const JSON_BOARDS: readonly JobSource[] = [remoteOk, remotive, himalayas, jobicy, arbeitnow];

/**
 * Every source Applio polls (SPEC F2), ids matching the default `Source` list.
 * The ATS watchlist reads the operator's companies at poll time.
 */
export function createAllSources(watchlist: () => readonly WatchEntry[]): JobSource[] {
  return [...JSON_BOARDS, weWorkRemotely, createAtsWatchlist(watchlist), hackerNews];
}

/** Every host any source may contact; the polite client refuses the rest. */
export const SOURCE_HOSTS: readonly string[] = createAllSources(() => []).flatMap((s) => s.hosts);
