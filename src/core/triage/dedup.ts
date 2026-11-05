import type { DiscoveredJob } from '../jobs/source';
import { companyKey, titleWords } from './words';

/**
 * Identity of a job across sources: normalized company + normalized title (SPEC F3).
 * The apply URL isn't part of it, because every board links to its own copy.
 */
export function dedupKey(job: Pick<DiscoveredJob, 'company' | 'title'>): string {
  return `${companyKey(job.company)}|${titleWords(job.title).join(' ')}`;
}

export type KeyedJob = DiscoveredJob & { dedupKey: string };

/**
 * Keeps the first of each job and drops repeats, both within this batch and
 * against jobs Applio already has (any status, sent ones included), so a
 * repost never re-queues an application.
 * perf: one Set lookup per job; existing keys come from the indexed dedup_key column.
 */
export function dedupe(jobs: readonly DiscoveredJob[], existingKeys: ReadonlySet<string>): { fresh: KeyedJob[]; duplicates: number } {
  const seen = new Set(existingKeys);
  const fresh: KeyedJob[] = [];
  for (const job of jobs) {
    const key = dedupKey(job);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push({ ...job, dedupKey: key });
  }
  return { fresh, duplicates: jobs.length - fresh.length };
}
