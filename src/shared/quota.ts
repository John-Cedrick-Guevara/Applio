import type { Quota } from './types';

export type QuotaLevel = 'ok' | 'warn' | 'stop';

/**
 * Classifies a quota against its warn and hard-stop thresholds (SPEC F10).
 * A non-positive limit means "nothing allowed", so it reads as stopped.
 */
export function quotaLevel(quota: Quota): QuotaLevel {
  if (quota.limit <= 0 || quota.used >= quota.limit) return 'stop';
  if (quota.used >= quota.limit * quota.warnAt) return 'warn';
  return 'ok';
}

/** Usage as a whole percentage, clamped to 0–100 for meters. */
export function quotaPercent(quota: Quota): number {
  if (quota.limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((quota.used / quota.limit) * 100)));
}
