import { describe, expect, it } from 'vitest';
import type { Quota } from './types';
import { quotaLevel, quotaPercent } from './quota';

const quota = (used: number, limit = 100, warnAt = 0.8): Quota => ({
  id: 'q', label: 'Q', sub: 'Per day', used, limit, warnAt, unit: 'calls',
});

describe('quotaLevel', () => {
  it('is ok below the warning threshold', () => {
    expect(quotaLevel(quota(79))).toBe('ok');
  });

  it('warns at the warning threshold', () => {
    expect(quotaLevel(quota(80))).toBe('warn');
  });

  it('stops at the limit', () => {
    expect(quotaLevel(quota(100))).toBe('stop');
    expect(quotaLevel(quota(130))).toBe('stop');
  });

  it('treats a zero limit as stopped', () => {
    expect(quotaLevel(quota(0, 0))).toBe('stop');
  });
});

describe('quotaPercent', () => {
  it('returns usage as a whole percentage clamped to 0–100', () => {
    expect(quotaPercent(quota(42))).toBe(42);
    expect(quotaPercent(quota(250))).toBe(100);
    expect(quotaPercent(quota(5, 0))).toBe(100);
  });
});
