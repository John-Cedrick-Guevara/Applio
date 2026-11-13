import type { AppStatus, Job } from '../../../shared/types';
import { formatTokens } from '../../lib/format';
import { isNew } from '../../lib/job-lists';

export type MatchTab = 'strong' | 'below' | 'unscored' | 'all';

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
}

/** Which tab a job sits under: at or above the draft bar, below it, or not scored yet. */
export function bucketOf(job: Job, bar: number): Exclude<MatchTab, 'all'> {
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
    .filter((j) => f.tab === 'all' || bucketOf(j, f.bar) === f.tab)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/** Every tab's count under the same search and new filter, so switching tabs never surprises. */
export function tabCounts(jobs: readonly Job[], f: Filters): Record<MatchTab, number> {
  const rows = filtered(jobs, f);
  const count = (tab: Exclude<MatchTab, 'all'>) => rows.filter((j) => bucketOf(j, f.bar) === tab).length;
  return { strong: count('strong'), below: count('below'), unscored: count('unscored'), all: rows.length };
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
