import { describe, expect, it } from 'vitest';
import { canOverlap, jobOffsets, parseHoursPreference } from './hours';

describe('parseHoursPreference', () => {
  it('reads the hours and the UTC range, including a typographic minus', () => {
    expect(parseHoursPreference('At least 4h with UTC−5 to UTC+2')).toEqual({ hours: 4, from: -5, to: 2 });
    expect(parseHoursPreference('3 hours overlap, UTC+1 – UTC+8')).toEqual({ hours: 3, from: 1, to: 8 });
  });

  it('reads nothing without a UTC range', () => {
    expect(parseHoursPreference('Flexible')).toBeUndefined();
    expect(parseHoursPreference('')).toBeUndefined();
  });
});

describe('jobOffsets', () => {
  it('uses offsets the board gives, or a UTC range in the location', () => {
    expect(jobOffsets({ location: 'Anywhere', utcOffsets: [-5, -4] })).toEqual([-5, -4]);
    expect(jobOffsets({ location: 'Remote (UTC-3 to UTC+1)' })).toEqual([-3, -2, -1, 0, 1]);
    expect(jobOffsets({ location: 'GMT+8' })).toEqual([8]);
  });

  it('knows nothing from a location without offsets', () => {
    expect(jobOffsets({ location: 'Remote, United States' })).toBeUndefined();
  });
});

describe('canOverlap', () => {
  const pref = { hours: 4, from: -5, to: 2 };

  it('keeps a job inside the range', () => {
    expect(canOverlap([0], pref)).toBe(true);
  });

  it('keeps a job close enough to share the required hours of an 8-hour day', () => {
    expect(canOverlap([6], pref)).toBe(true);
  });

  it('drops a job too far away to share the required hours', () => {
    expect(canOverlap([8], pref)).toBe(false);
  });

  it('keeps a job when any of its offsets works', () => {
    expect(canOverlap([10, -6], pref)).toBe(true);
  });
});
