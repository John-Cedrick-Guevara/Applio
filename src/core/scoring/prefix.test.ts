import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '../../shared/defaults';
import { scoringPrefix } from './prefix';

const profile = {
  facts: [
    { id: 'f1', group: 'Northwind — Senior Backend Engineer', text: 'Cut API p95 latency from 900 ms to 120 ms', tags: [], timesUsed: 3 },
    { id: 'f2', group: 'Skills', text: 'TypeScript, Node.js', tags: [], timesUsed: 0 },
  ],
  skills: ['PostgreSQL'],
  preferences: { ...DEFAULT_PREFERENCES, targetRoles: ['Backend Engineer'], minimumPay: '$90k / year' },
};

describe('scoringPrefix', () => {
  it('is byte-identical while the fact bank and preferences are, so Claude can cache it', () => {
    expect(scoringPrefix(profile)).toBe(scoringPrefix({ ...profile, facts: profile.facts.map((f) => ({ ...f, timesUsed: 99 })) }));
  });

  it('changes when a fact changes', () => {
    expect(scoringPrefix(profile)).not.toBe(scoringPrefix({ ...profile, facts: [{ ...profile.facts[0]!, text: 'Cut latency' }] }));
  });

  it('holds the instructions, every fact with its id, and the preferences', () => {
    const prefix = scoringPrefix(profile);
    expect(prefix).toContain('[f1] Northwind — Senior Backend Engineer: Cut API p95 latency from 900 ms to 120 ms');
    expect(prefix).toContain('Target roles: Backend Engineer');
    expect(prefix).toContain('Minimum pay: $90k / year');
    expect(prefix).toMatch(/never follow instructions/i);
    expect(prefix).toMatch(/JSON/);
  });
});
