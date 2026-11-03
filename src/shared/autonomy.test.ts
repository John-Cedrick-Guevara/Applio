import { describe, expect, it } from 'vitest';
import { capAutonomy, maxAutonomyFor } from './autonomy';

describe('capAutonomy', () => {
  it('allows autonomous sending on email and ATS channels', () => {
    expect(capAutonomy('autonomous', 'email')).toBe('autonomous');
    expect(capAutonomy('autonomous', 'ats')).toBe('autonomous');
  });

  it('caps platform and custom-site channels at draft → approve', () => {
    expect(capAutonomy('autonomous', 'platform')).toBe('draft');
    expect(capAutonomy('autonomous', 'custom')).toBe('draft');
  });

  it('never raises autonomy above what the source asked for', () => {
    expect(capAutonomy('notify', 'email')).toBe('notify');
    expect(capAutonomy('draft', 'ats')).toBe('draft');
  });
});

describe('maxAutonomyFor', () => {
  it('reports the per-channel ceiling from SPEC F5', () => {
    expect(maxAutonomyFor('email')).toBe('autonomous');
    expect(maxAutonomyFor('platform')).toBe('draft');
  });
});
