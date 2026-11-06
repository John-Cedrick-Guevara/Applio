import type { Job } from '../../shared/types';

/** Days of silence after which an application counts as No reply (SPEC F7). */
export const NO_REPLY_DAYS = 21;

/** Applications still Applied whose last event (sent or followed up) is at least 21 days old. */
export function silentApplications(jobs: readonly Job[], now: Date): string[] {
  const cutoff = now.getTime() - NO_REPLY_DAYS * 86_400_000;
  return jobs.filter((j) => j.status === 'applied' && Date.parse(j.history.at(-1)?.at ?? '') <= cutoff).map((j) => j.id);
}
