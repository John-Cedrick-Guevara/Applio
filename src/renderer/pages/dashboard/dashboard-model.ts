import type { AppStatus, Job, SentBy } from '../../../shared/types';
import { shareBlocks } from '../../lib/cost';
import { newCount } from '../../lib/job-lists';
import { displayStatus, sentAt } from '../applications/applications-model';
import { inboxTabs } from '../review/review-model';



/** Sends that went through the app after the operator's click (or on their own); everything else the operator did by hand. */
const BY_APPLIO: readonly SentBy[] = ['autonomous', 'you-app', 'you-telegram'];

/** Midnight at the start of `d`'s day, local time. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Monday 00:00 of `d`'s week, local time. */
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

/** A job's first send: the first `applied` event (later ones are follow-ups). Absent for anything never sent. */
const sentTime = (job: Job): number | undefined => {
  const at = sentAt(job);
  return at ? Date.parse(at) : undefined;
};

const bySender = (job: Job) => (job.sentBy && BY_APPLIO.includes(job.sentBy) ? 'app' : 'you');

export interface NeedsRow {
  key: 'fix' | 'answer' | 'approve' | 'handoff';
  label: string;
  hint: string;
  count: number;
}

/**
 * The four Inbox decisions with the counts the Inbox tabs show. Reuses `inboxTabs` so
 * the two can never disagree; `asking` is the number of jobs Claude has open questions on.
 */
export function needs(queue: readonly Job[], asking: number): { rows: NeedsRow[]; total: number } {
  const tabs = inboxTabs(queue, [], 'score');
  const tab = (key: NeedsRow['key']) => tabs.find((t) => t.key === key)?.jobs.length ?? 0;
  const rows: NeedsRow[] = [
    { key: 'fix', label: 'Fix first', hint: 'failed sends, posts to check', count: tab('fix') },
    { key: 'answer', label: 'Answer', hint: 'Claude asked', count: asking },
    { key: 'approve', label: 'Approve', hint: 'drafts ready', count: tab('approve') },
    { key: 'handoff', label: 'Hand off', hint: 'you apply', count: tab('handoff') },
  ];
  return { rows, total: rows.reduce((sum, r) => sum + r.count, 0) };
}

/** "Sent this week": sends since Monday 00:00 against the weekly goal. */
export function weekCard(jobs: readonly Job[], goal: number, now: Date) {
  const from = startOfWeek(now).getTime();
  const sent = jobs.filter((j) => (sentTime(j) ?? -Infinity) >= from);
  const byApplio = sent.filter((j) => bySender(j) === 'app').length;
  const byYou = sent.length - byApplio;
  const total = Math.min(goal, 20);
  const rest = sent.length >= goal ? 'Goal met.' : `${goal - sent.length} more to hit your goal by Sunday.`;
  return {
    sent: sent.length,
    byApplio,
    byYou,
    goal,
    pct: Math.round((sent.length / goal) * 100),
    blocks: { filled: shareBlocks(sent.length / goal, total), total },
    line: `${byApplio} sent by Applio, ${byYou} you applied yourself. ${rest}`,
  };
}

/** "AI budget today": tokens used of the daily budget. */
export function budgetCard(status: Pick<AppStatus, 'tokensToday' | 'dailyTokenBudget' | 'budgetStop'>) {
  const share = status.tokensToday / Math.max(1, status.dailyTokenBudget);
  return {
    used: status.tokensToday,
    total: status.dailyTokenBudget,
    pct: Math.min(100, Math.round(share * 100)),
    blocks: { filled: shareBlocks(share, 8), total: 8 },
    stopped: !!status.budgetStop,
    /** Why AI stopped, as main words it (daily or monthly), so the card never guesses. */
    stopReason: status.budgetStop,
  };
}

export type SentRange = 'day' | 'week';

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** Sends per bucket, split Applio vs you: the last 10 days or last 8 weeks, ending now. */
export function sentSeries(jobs: readonly Job[], range: SentRange, now: Date) {
  const count = range === 'day' ? 10 : 8;
  const last = range === 'day' ? startOfDay(now) : startOfWeek(now);
  const step = range === 'day' ? 1 : 7;
  const starts = Array.from({ length: count }, (_, i) => {
    const d = new Date(last);
    d.setDate(d.getDate() - (count - 1 - i) * step);
    return d;
  });
  const labels = starts.map((d, i) =>
    i === count - 1 ? (range === 'day' ? 'Today' : 'This wk') : range === 'day' ? `${weekday.format(d)} ${d.getDate()}` : dayMonth.format(d),
  );
  const app = new Array<number>(count).fill(0);
  const you = new Array<number>(count).fill(0);
  for (const job of jobs) {
    const t = sentTime(job);
    if (t === undefined) continue;
    // Last bucket whose start is not after the send; sends before the first bucket fall outside the chart.
    const i = starts.findLastIndex((s) => s.getTime() <= t);
    if (i < 0) continue;
    (bySender(job) === 'app' ? app : you)[i]! += 1;
  }
  return { labels, app, you, // A floor of 3 keeps the axis ticks whole numbers (3, 2, 1, 0) when little was sent.
    max: Math.max(3, ...app.map((a, i) => a + you[i]!)) };
}

/** The four "Up next" tiles, from records. */
export function upNext(jobs: readonly Job[], { followUpDays, lastRunAt, sources, now }: { followUpDays: number; lastRunAt?: string; sources: number; now: Date }) {
  const statuses = jobs.map((j) => displayStatus(j, followUpDays, now));
  return {
    replies: jobs.filter((j) => j.status === 'replied').length,
    followUps: statuses.filter((s) => s === 'Follow-up due').length,
    newMatches: newCount(jobs.filter((j) => j.status === 'found' || j.status === 'scored'), lastRunAt),
    lastRunAt,
    sources,
  };
}

export type PipelinePeriod = 'month' | 'all';

const reached = (job: Job, ...statuses: Job['status'][]) => job.history.some((e) => statuses.includes(e.status));

/** How far jobs got: counts per stage from each job's history, bars scaled to Found, conversion from the stage before. */
export function pipeline(jobs: readonly Job[], period: PipelinePeriod, now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const inPeriod = period === 'all' ? jobs : jobs.filter((j) => Date.parse(j.history[0]?.at ?? '') >= monthStart);
  const counts: [string, number][] = [
    ['Found', inPeriod.length],
    ['Matched', inPeriod.filter((j) => j.score !== undefined || reached(j, 'scored')).length],
    ['Drafted', inPeriod.filter((j) => reached(j, 'drafted')).length],
    ['Applied', inPeriod.filter((j) => sentTime(j) !== undefined).length],
    ['Replied', inPeriod.filter((j) => reached(j, 'replied', 'interview', 'offer')).length],
    ['Interview', inPeriod.filter((j) => reached(j, 'interview', 'offer')).length],
    ['Offer', inPeriod.filter((j) => reached(j, 'offer')).length],
  ];
  // A job can reach Replied without an Applied event (marked by hand); clamp so a stage never exceeds the one before it.
  counts.forEach((c, i) => { if (i > 0) c[1] = Math.min(c[1], counts[i - 1]![1]); });
  const top = counts[0]![1];
  const stages = counts.map(([label, n], i) => ({
    label,
    n,
    conv: i === 0 ? 'every job found' : `${counts[i - 1]![1] ? Math.round((n / counts[i - 1]![1]) * 100) : 0}% of ${counts[i - 1]![0].toLowerCase()}`,
    width: top ? (n / top) * 100 : 0,
  }));
  const closed = {
    rejected: inPeriod.filter((j) => j.status === 'rejected').length,
    noReply: inPeriod.filter((j) => j.status === 'ghosted').length,
    skipped: inPeriod.filter((j) => j.status === 'skipped').length,
  };
  return { stages, closed };
}

