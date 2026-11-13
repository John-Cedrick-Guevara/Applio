import type { AppStatus, Job } from '../../../shared/types';
import { formatTokens } from '../../lib/format';
import { isNew } from '../../lib/job-lists';

export type MatchTab = 'strong' | 'below' | 'unscored' | 'trash' | 'all';

/** A typical draft's tokens: an estimate for the operator, not a cap (main's quota guard enforces the stop). */
export const DRAFT_TOKENS = 30_000;

/** A typical score for one job, also an estimate. */
export const SCORE_TOKENS = 2_000;

interface Filters {
  bar: number;
  tab: MatchTab;
  query: string;
  onlyNew: boolean;
  /** The last scan's time; jobs first seen at or after it are new. */
  lastRunAt?: string;
  /** Jobs Claude is drafting now; the activity bar shows them instead. */
  drafting: readonly string[];
  /** The clock for "trashed long ago" (ms); defaults to now. */
  now?: number;
  /** Shows jobs trashed more than OLD_TRASH_DAYS ago, which the Trash tab collapses by default. */
  showOldTrash?: boolean;
}

const DAY_MS = 86_400_000;
/** The Trash tab collapses jobs trashed longer ago than this behind "Show older". */
export const OLD_TRASH_DAYS = 30;

/** When a trashed job was skipped: the first event after its last non-skipped one (later notes carry the same status). */
export function trashedAt(job: Job): string {
  const i = job.history.findLastIndex((e) => e.status !== 'skipped');
  return (job.history[i + 1] ?? job.history.at(-1))?.at ?? job.postedAt;
}

/** True for a trashed job skipped more than OLD_TRASH_DAYS before `now`. */
export function isOldTrash(job: Job, now = Date.now()): boolean {
  return job.status === 'skipped' && now - Date.parse(trashedAt(job)) > OLD_TRASH_DAYS * DAY_MS;
}

/** Which tab a job sits under: the Trash (skipped), at or above the draft bar, below it, or not scored yet. */
export function bucketOf(job: Job, bar: number): Exclude<MatchTab, 'all'> {
  if (job.status === 'skipped') return 'trash';
  if (job.status !== 'scored' || job.score === undefined) return 'unscored';
  return job.score >= bar ? 'strong' : 'below';
}

/** Everything but the tab: drafting jobs out, then search and the new filter. */
function filtered(jobs: readonly Job[], f: Omit<Filters, 'tab'>): Job[] {
  const q = f.query.trim().toLowerCase();
  return jobs.filter((j) =>
    !f.drafting.includes(j.id)
    && (!q || `${j.title} ${j.company}`.toLowerCase().includes(q))
    && (!f.onlyNew || isNew(j, f.lastRunAt)));
}

/** The rows for the current tab, best score first and unscored last. */
export function matchRows(jobs: readonly Job[], f: Filters): Job[] {
  return filtered(jobs, f)
    // "All" means every live match; the Trash is its own tab.
    .filter((j) => (f.tab === 'all' ? bucketOf(j, f.bar) !== 'trash' : bucketOf(j, f.bar) === f.tab))
    .filter((j) => f.tab !== 'trash' || f.showOldTrash || !isOldTrash(j, f.now))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** Every tab's count under the same search and new filter, so switching tabs never surprises. */
export function tabCounts(jobs: readonly Job[], f: Filters): Record<MatchTab, number> {
  const rows = filtered(jobs, f);
  const count = (tab: Exclude<MatchTab, 'all'>) => rows.filter((j) => bucketOf(j, f.bar) === tab).length;
  const trash = count('trash');
  return { strong: count('strong'), below: count('below'), unscored: count('unscored'), trash, all: rows.length - trash };
}

/**
 * What drafting a selection would cost against today's budget. Unscored jobs can't
 * be drafted, so they're left out and counted. `block` says why Draft n is off.
 */
export function draftEstimate(selected: readonly Job[], status: Pick<AppStatus, 'tokensToday' | 'dailyTokenBudget' | 'budgetStop'>): { draftable: number; leftOut: number; cost: number; left: number; block?: string } {
  const draftable = selected.filter((j) => j.status === 'scored').length;
  const cost = draftable * DRAFT_TOKENS;
  const left = Math.max(0, status.dailyTokenBudget - status.tokensToday);
  const result = { draftable, leftOut: selected.length - draftable, cost, left };
  if (status.budgetStop) return { ...result, block: status.budgetStop };
  if (cost > left) {
    return { ...result, block: `About ${formatTokens(cost)} tokens is more than the ${formatTokens(left)} left today. Pick ${Math.floor(left / DRAFT_TOKENS)} or fewer, or raise the budget.` };
  }
  return result;
}

/**
 * The matches Clean up would move to the Trash (manual, previewed first): found or
 * scored jobs that are old (first seen `olderDays` or more ago) or below the draft bar.
 * Never drafted, approved or sent jobs, and never one Claude is drafting. `older` and
 * `below` are what each rule finds on its own, for the counts; `picked` is the union
 * of the rules that are switched on.
 */
export function staleMatches(
  jobs: readonly Job[],
  { olderOn, olderDays, belowOn, bar, drafting, now }: { olderOn: boolean; olderDays: number; belowOn: boolean; bar: number; drafting: readonly string[]; now: number },
): { older: Job[]; below: Job[]; picked: Job[] } {
  const matches = jobs.filter((j) => (j.status === 'found' || j.status === 'scored') && !drafting.includes(j.id));
  const older = matches.filter((j) => (now - Date.parse(j.history[0]?.at ?? j.postedAt)) / DAY_MS >= olderDays);
  const below = matches.filter((j) => j.status === 'scored' && (j.score ?? 0) < bar);
  const picked = matches.filter((j) => (olderOn && older.includes(j)) || (belowOn && below.includes(j)));
  return { older, below, picked };
}
