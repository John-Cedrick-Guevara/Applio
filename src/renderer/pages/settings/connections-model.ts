import type { ConnectionCheck } from '../../../shared/types';
import { formatRelative } from '../../lib/format';

export interface ConnectionBadge {
  label: 'Not set up' | 'Saved, not verified' | 'Connected' | "Can't sign in";
  tone: 'warning' | 'success' | 'danger';
  /** Why, under the badge: when it was verified, or the service's own reason. */
  detail?: string;
}

/**
 * A connection's status from its last sign-in check, never from a saved secret
 * alone: Connected only after the credentials worked, Can't sign in when they were
 * rejected, and Saved, not verified when nothing has proven them either way.
 */
export function connectionBadge(complete: boolean, check: ConnectionCheck | undefined): ConnectionBadge {
  if (!complete) return { label: 'Not set up', tone: 'warning' };
  if (!check) return { label: 'Saved, not verified', tone: 'warning', detail: 'Applio hasn’t signed in with these yet. Use the test button.' };
  if (check.ok) return { label: 'Connected', tone: 'success', detail: `Verified ${formatRelative(check.at)}` };
  if (check.offline) return { label: 'Saved, not verified', tone: 'warning', detail: check.message };
  return { label: "Can't sign in", tone: 'danger', detail: check.message };
}
