import type { JobSource } from '../../core/jobs/source';
import { arbeitnow } from './arbeitnow';
import { himalayas } from './himalayas';
import { jobicy } from './jobicy';
import { remoteOk } from './remoteok';
import { remotive } from './remotive';

export { createPoliteHttp, SourceUnavailableError, type FetchLike } from './polite-http';

/** The public JSON boards (PR-11a). RSS, the ATS watchlist and HN join in PR-11b. */
export const JSON_BOARDS: readonly JobSource[] = [remoteOk, remotive, himalayas, jobicy, arbeitnow];

/** Every host any source may contact; the polite client refuses the rest. */
export const SOURCE_HOSTS: readonly string[] = JSON_BOARDS.flatMap((s) => s.hosts);
