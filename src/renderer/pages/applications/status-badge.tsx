import type { DisplayStatus } from './applications-model';

const TONE: Record<DisplayStatus, string> = {
  Applied: 'badge-neutral',
  'Follow-up due': 'badge-warning',
  Replied: 'badge-accent',
  Interview: 'badge-success',
  Offer: 'badge-success',
  Rejected: 'badge-muted',
  'No reply': 'badge-muted',
};

/** Application status pill, colored as in the prototype. */
export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <span className={`badge ${TONE[status]}`}>{status}</span>;
}
