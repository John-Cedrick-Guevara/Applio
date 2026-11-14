import type { AppStatus } from '../../shared/types';
import { formatTokens } from './format';

/**
 * A spend's cost against what's left of today's token budget, said before the
 * click (SPEC F10): "≈ 8k tokens · 12% of the 68k left today".
 */
export function costLine(tokens: number, status: Pick<AppStatus, 'tokensToday' | 'dailyTokenBudget'>): string {
  const left = Math.max(0, status.dailyTokenBudget - status.tokensToday);
  const cost = `≈ ${formatTokens(tokens)} tokens`;
  if (left === 0) return `${cost} · nothing left today`;
  if (tokens > left) return `${cost} · more than the ${formatTokens(left)} left today`;
  return `${cost} · ${Math.max(1, Math.round((tokens / left) * 100))}% of the ${formatTokens(left)} left today`;
}

/**
 * The same share as `costLine`, as 0-10 blocks for a meter: any cost fills one, each
 * further tenth of what is left fills another, and it is full when the cost reaches
 * what is left, when nothing is left, or when AI is stopped by a budget.
 */
export function costBlocks(tokens: number, status: Pick<AppStatus, 'tokensToday' | 'dailyTokenBudget' | 'budgetStop'>): number {
  const left = Math.max(0, status.dailyTokenBudget - status.tokensToday);
  if (left === 0 || status.budgetStop || tokens >= left) return 10;
  return Math.max(1, shareBlocks(tokens / left, 10));
}

/**
 * How many of `total` meter blocks a share fills: none for no use, at least one for any use,
 * and the last only at the whole, so a meter never reads empty or exhausted early.
 */
export function shareBlocks(share: number, total: number): number {
  if (share <= 0) return 0;
  return share >= 1 ? total : Math.min(total - 1, Math.ceil(share * total));
}
