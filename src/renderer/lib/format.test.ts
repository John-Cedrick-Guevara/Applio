import { describe, expect, it } from 'vitest';
import { formatRelative, formatTokens } from './format';

describe('formatTokens', () => {
  it('keeps small numbers as-is', () => {
    expect(formatTokens(950)).toBe('950');
  });

  it('abbreviates thousands and millions to one decimal', () => {
    expect(formatTokens(1_250)).toBe('1.3k');
    expect(formatTokens(3_400_000)).toBe('3.4M');
  });

  it('drops a trailing .0', () => {
    expect(formatTokens(150_000)).toBe('150k');
    expect(formatTokens(3_000_000)).toBe('3M');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-11-03T12:00:00Z');

  it('describes recent times relative to now', () => {
    expect(formatRelative('2026-11-03T11:59:30Z', now)).toBe('just now');
    expect(formatRelative('2026-11-03T11:55:00Z', now)).toBe('5m ago');
    expect(formatRelative('2026-11-03T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelative('2026-11-01T12:00:00Z', now)).toBe('2d ago');
  });

  it('falls back to a date after a week', () => {
    expect(formatRelative('2026-10-01T12:00:00Z', now)).toBe('Oct 1, 2026');
  });
});
