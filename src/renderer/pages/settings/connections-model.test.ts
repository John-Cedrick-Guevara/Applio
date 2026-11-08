import { describe, expect, it } from 'vitest';
import { formatRelative } from '../../lib/format';
import { connectionBadge } from './connections-model';

const at = '2026-11-08T09:00:00.000Z';

describe('connectionBadge', () => {
  it('is Not set up while a credential is missing', () => {
    expect(connectionBadge(false, undefined)).toEqual({ label: 'Not set up', tone: 'warning' });
  });

  it('never says Connected for credentials that have not signed in yet', () => {
    expect(connectionBadge(true, undefined)).toEqual({ label: 'Saved, not verified', tone: 'warning', detail: 'Applio hasn’t signed in with these yet. Use the test button.' });
  });

  it('says Connected with when it was verified', () => {
    expect(connectionBadge(true, { ok: true, at, message: 'Signed in to Gmail.' })).toEqual({ label: 'Connected', tone: 'success', detail: `Verified ${formatRelative(at)}` });
  });

  it("says it can't sign in, with the service's reason, when the credentials were rejected", () => {
    expect(connectionBadge(true, { ok: false, at, message: 'Gmail rejected the address or app password.' })).toEqual({ label: "Can't sign in", tone: 'danger', detail: 'Gmail rejected the address or app password.' });
  });

  it('says not verified, not wrong, when the service could not be reached', () => {
    expect(connectionBadge(true, { ok: false, offline: true, at, message: "Couldn't reach Gmail." })).toEqual({ label: 'Saved, not verified', tone: 'warning', detail: "Couldn't reach Gmail." });
  });
});
