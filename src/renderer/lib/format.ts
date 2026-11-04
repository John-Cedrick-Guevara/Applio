/** One decimal, dropping a trailing ".0" (150.0 → "150"). */
const oneDecimal = (n: number) => n.toFixed(1).replace(/\.0$/, '');

/** Compact token counts for tables and meters: 950, 1.3k, 150k, 3.4M. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${oneDecimal(n / 1_000_000)}M`;
  if (n >= 1_000) return `${oneDecimal(n / 1_000)}k`;
  return String(n);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

/**
 * Short relative time ("5m ago") for the last week, then a plain date.
 * `now` is injectable so callers and tests get stable output.
 */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return dateFormat.format(new Date(iso));
}

const clockFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 24-hour local clock time, e.g. "08:00" — how the prototype shows run and send times. */
export function formatClock(iso: string): string {
  return clockFormat.format(new Date(iso));
}

const shortDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** Month and day, e.g. "Oct 29" — dates in tables and timelines. */
export function formatShortDate(iso: string): string {
  return shortDateFormat.format(new Date(iso));
}
