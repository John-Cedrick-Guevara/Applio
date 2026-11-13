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
