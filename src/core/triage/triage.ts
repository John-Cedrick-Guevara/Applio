import type { Preferences } from '../../shared/types';
import type { DiscoveredJob } from '../jobs/source';
import { dedupe, type KeyedJob } from './dedup';
import { canOverlap, jobOffsets, parseHoursPreference } from './hours';
import { meetsMinimumPay } from './pay';
import { eligibility, homeCountry } from './location';
import { companyKey, roleMatches, titleWords } from './words';

export type DropReason = 'blocklist' | 'type' | 'remote' | 'role' | 'seniority' | 'location' | 'pay' | 'hours';

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
  /** The operator's profile location line; its country drives the location rule. Unreadable skips the rule. */
  homeLocation?: string;
}

/** Titles above an entry-level operator, and above a mid-level one. */
const ABOVE_ENTRY = /\b(?:senior|sr\.?|staff|principal|lead|head of|director|architect|vp|vice president|distinguished)\b/i;
const ABOVE_MID = /\b(?:staff|principal|head of|director|vp|vice president|distinguished)\b/i;
/** Wording that opens a senior-sounding title to juniors too ("junior to senior", "Engineer I"). */
const JUNIOR = /\b(?:junior|jr\.?|entry|associate|graduate|intern(?:ship)?|trainee)\b|\bengineer i\b|\bdeveloper i\b/i;

/** Which titles the operator's free-text seniority rules out, if any. */
const tooSenior = (seniority: string): RegExp | undefined =>
  /intern|entry|junior|graduate|fresh|trainee/i.test(seniority) ? ABOVE_ENTRY : /\bmid|intermediate/i.test(seniority) ? ABOVE_MID : undefined;

/**
 * The free part of the pipeline (SPEC F3.1–3.2): dedup, then the prefilter, so
 * AI tokens are only spent on plausible matches. Each job is dropped for the
 * first rule it fails, in order: blocklist, type, remote, role, seniority, location,
 * pay, hours. Anything Applio can't read (no pay, no hours, no place) is kept.
 */
/** `fresh`: the keys of every job not already stored, passed or dropped, for counting what's new. */
export function triage(jobs: readonly DiscoveredJob[], { existingKeys, preferences, blocklist, homeLocation = '' }: TriageOptions): { passed: KeyedJob[]; fresh: string[]; report: TriageReport } {
  const { fresh, duplicates } = dedupe(jobs, existingKeys);
  const blocked = new Set(blocklist.map(companyKey));
  const roles = preferences.targetRoles.map(titleWords).filter((words) => words.length > 0);
  const hours = parseHoursPreference(preferences.hoursOverlap);
  const above = tooSenior(preferences.seniority);
  const country = homeCountry(homeLocation);

  const reasonFor = (job: KeyedJob): DropReason | undefined => {
    if (blocked.has(companyKey(job.company))) return 'blocklist';
    if (job.employmentType && preferences.employmentTypes.length > 0 && !preferences.employmentTypes.includes(job.employmentType)) return 'type';
    if (preferences.remoteOnly && job.remote === false) return 'remote';
    if (roles.length > 0 && !roles.some((role) => roleMatches(job.title, role))) return 'role';
    if (above?.test(job.title) && !JUNIOR.test(job.title)) return 'seniority';
    if (country) {
      // Boards often put the region in the title ("Engineer - EU") and "Anywhere" in the location.
      const fromTitle = eligibility(job.title, country);
      if (fromTitle === 'excludes' || (fromTitle === 'unknown' && eligibility(job.location, country) === 'excludes')) return 'location';
    }
    if (!meetsMinimumPay(job.salary, preferences.minimumPay)) return 'pay';
    const offsets = hours ? jobOffsets(job) : undefined;
    if (hours && offsets && !canOverlap(offsets, hours)) return 'hours';
    return undefined;
  };

  const dropped: Record<DropReason, number> = { blocklist: 0, type: 0, remote: 0, role: 0, seniority: 0, location: 0, pay: 0, hours: 0 };
  const passed: KeyedJob[] = [];
  for (const job of fresh) {
    const reason = reasonFor(job);
    if (reason) dropped[reason]++;
    else passed.push(job);
  }
  return { passed, fresh: fresh.map((j) => j.dedupKey), report: { found: jobs.length, duplicates, dropped, passed: passed.length } };
}
