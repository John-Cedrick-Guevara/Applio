import type { Job, SentBy } from '../../../shared/types';
import { formatShortDate, formatTokens } from '../../lib/format';
import { CHANNEL_LABEL } from '../../lib/labels';

/** Statuses as the Applications screen words them. "Follow-up due" is derived, not stored. */
export type DisplayStatus = 'Applied' | 'Follow-up due' | 'Replied' | 'Interview' | 'Offer' | 'Rejected' | 'No reply';

export type FilterGroup = 'waiting' | 'replied' | 'interview' | 'closed';

const DAY = 86_400_000;

export const SENT_BY_LABEL: Record<SentBy, string> = {
  autonomous: 'Autonomous',
  'you-app': 'You, in app',
  'you-telegram': 'You, via Telegram',
  'you-manual': 'You, manually',
};

/** When the application first went out. */
export function sentAt(job: Job): string | undefined {
  return job.history.find((e) => e.status === 'applied')?.at;
}

/** True when an application has waited longer than the follow-up window since the last contact. */
function followUpDue(job: Job, followUpDays: number, now: Date): boolean {
  if (job.status !== 'applied') return false;
  const last = job.history.at(-1)?.at;
  return !!last && now.getTime() - new Date(last).getTime() > followUpDays * DAY;
}

/** The status shown in the table and detail badge. */
export function displayStatus(job: Job, followUpDays: number, now: Date): DisplayStatus {
  switch (job.status) {
    case 'replied': return 'Replied';
    case 'interview': return 'Interview';
    case 'offer': return 'Offer';
    case 'rejected': return 'Rejected';
    case 'ghosted': return 'No reply';
    default: return followUpDue(job, followUpDays, now) ? 'Follow-up due' : 'Applied';
  }
}

const GROUP: Record<DisplayStatus, FilterGroup> = {
  Applied: 'waiting',
  'Follow-up due': 'waiting',
  Replied: 'replied',
  Interview: 'interview',
  Offer: 'interview',
  Rejected: 'closed',
  'No reply': 'closed',
};

/** Which filter pill a status falls under. */
export function filterGroup(status: DisplayStatus): FilterGroup {
  return GROUP[status];
}

/** Header numbers. Replies count any human response that isn't a rejection. */
export function appStats(jobs: Job[], followUpDays: number, now: Date) {
  const statuses = jobs.map((j) => displayStatus(j, followUpDays, now));
  return {
    sentThisMonth: jobs.filter((j) => {
      const at = sentAt(j);
      if (!at) return false;
      const d = new Date(at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length,
    replies: statuses.filter((s) => s === 'Replied' || s === 'Interview' || s === 'Offer').length,
    interviews: statuses.filter((s) => s === 'Interview' || s === 'Offer').length,
    followUpsDue: statuses.filter((s) => s === 'Follow-up due').length,
  };
}

export interface TimelineEvent {
  title: string;
  meta: string;
}

/** Human-readable timeline from the status history (SPEC F7), plus a nudge when a follow-up is due. */
export function timeline(job: Job, followUpDays: number, now: Date): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const e of job.history) {
    const date = formatShortDate(e.at);
    switch (e.status) {
      case 'found': events.push({ title: `Found on ${job.sourceName}`, meta: date }); break;
      case 'scored': events.push({ title: `Scored ${job.score ?? '—'}`, meta: date }); break;
      case 'drafted': events.push({ title: 'Resume and cover letter drafted', meta: `${formatTokens(job.tokensUsed)} tokens · ${job.factsUsed} facts used` }); break;
      case 'applied':
        events.push(e.note === 'Follow-up sent'
          ? { title: 'Follow-up sent', meta: `${date} · reply tracking restarted` }
          : { title: `Sent via ${CHANNEL_LABEL[job.channel]}`, meta: `${job.sentBy ? SENT_BY_LABEL[job.sentBy] : 'Sent'} · ${date}` });
        break;
      case 'replied': events.push({ title: 'Replied', meta: e.note ?? date }); break;
      case 'interview': events.push({ title: 'Interview', meta: e.note ?? date }); break;
      case 'offer': events.push({ title: 'Offer', meta: e.note ?? date }); break;
      case 'rejected': events.push({ title: 'Closed', meta: e.note ?? `Rejected · ${date}` }); break;
      case 'ghosted': events.push({ title: 'Marked no reply', meta: e.note ?? date }); break;
      default: break; // approved/skipped aren't shown on an application's timeline
    }
  }
  if (followUpDue(job, followUpDays, now)) events.push({ title: `No reply in ${followUpDays} days`, meta: 'Follow-up suggested' });
  return events;
}
