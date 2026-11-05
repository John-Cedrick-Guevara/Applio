import type { Preferences } from '../../shared/types';
import type { DiscoveredJob } from '../jobs/source';
import { dedupe, type KeyedJob } from './dedup';
import { canOverlap, jobOffsets, parseHoursPreference } from './hours';
import { meetsMinimumPay } from './pay';
import { companyKey, titleWords } from './words';

export type DropReason = 'blocklist' | 'type' | 'remote' | 'role' | 'pay' | 'hours';

/** What a run's triage did, for the run summary and the usage page's drop rates. */
export interface TriageReport {
  found: number;
  duplicates: number;
  dropped: Record<DropReason, number>;
  passed: number;
}

interface TriageOptions {
  /** Dedup keys of every job Applio already has, sent ones included. */
  existingKeys: ReadonlySet<string>;
  preferences: Preferences;
  blocklist: readonly string[];
}

/**
 * The free part of the pipeline (SPEC F3.1–3.2): dedup, then the prefilter, so
 * AI tokens are only spent on plausible matches. Each job is dropped for the
 * first rule it fails, in order: blocklist, type, remote, role, pay, hours.
 * Anything Applio can't read (no pay, no hours, no remote flag) is kept.
 */
export function triage(jobs: readonly DiscoveredJob[], { existingKeys, preferences, blocklist }: TriageOptions): { passed: KeyedJob[]; report: TriageReport } {
  const { fresh, duplicates } = dedupe(jobs, existingKeys);
  const blocked = new Set(blocklist.map(companyKey));
  const roles = preferences.targetRoles.map(titleWords).filter((words) => words.length > 0);
  const hours = parseHoursPreference(preferences.hoursOverlap);

  const reasonFor = (job: KeyedJob): DropReason | undefined => {
    if (blocked.has(companyKey(job.company))) return 'blocklist';
    if (job.employmentType && preferences.employmentTypes.length > 0 && !preferences.employmentTypes.includes(job.employmentType)) return 'type';
    if (preferences.remoteOnly && job.remote === false) return 'remote';
    if (roles.length > 0) {
      const words = new Set(titleWords(job.title));
      if (!roles.some((role) => role.every((w) => words.has(w)))) return 'role';
    }
    if (!meetsMinimumPay(job.salary, preferences.minimumPay)) return 'pay';
    const offsets = hours ? jobOffsets(job) : undefined;
    if (hours && offsets && !canOverlap(offsets, hours)) return 'hours';
    return undefined;
  };

  const dropped: Record<DropReason, number> = { blocklist: 0, type: 0, remote: 0, role: 0, pay: 0, hours: 0 };
  const passed: KeyedJob[] = [];
  for (const job of fresh) {
    const reason = reasonFor(job);
    if (reason) dropped[reason]++;
    else passed.push(job);
  }
  return { passed, report: { found: jobs.length, duplicates, dropped, passed: passed.length } };
}
