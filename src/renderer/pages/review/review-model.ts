import { capAutonomy, maxAutonomyFor } from '../../../shared/autonomy';
import type { ApplyChannel, Autonomy, Draft, Job, RunSummary, SendRecord, Settings } from '../../../shared/types';
import { formatClock } from '../../lib/format';
import { AUTONOMY_LABEL } from '../../lib/labels';

/** True when approving sends straight away (email, standard ATS); otherwise the operator applies (SPEC F5). */
export function sendsOnApprove(channel: ApplyChannel): boolean {
  return maxAutonomyFor(channel) === 'autonomous';
}

/** Label and behavior of the draft's main button. */
export function primaryAction(job: Job): { label: string; handoff: boolean } {
  if (job.channel === 'email') return { label: 'Approve & send email', handoff: false };
  if (job.channel === 'ats') return { label: 'Approve & submit form', handoff: false };
  return { label: 'Open handoff', handoff: true };
}

/** Short status shown under each queue row. Only a job past Approved is called Sent. */
export function queueState(job: Job): string {
  if (job.status === 'skipped') return 'Skipped';
  if (job.status === 'drafted') return sendsOnApprove(job.channel) ? 'Draft ready' : 'Ready to hand off';
  if (job.status === 'approved') return sendsOnApprove(job.channel) ? 'Not sent' : 'Ready to hand off';
  return 'Sent';
}

/** What automation may do with this job: its source's autonomy, capped by channel. */
export function modeLabel(job: Job, sourceAutonomy: Autonomy): string {
  return sendsOnApprove(job.channel) ? AUTONOMY_LABEL[capAutonomy(sourceAutonomy, job.channel)] : 'Manual handoff';
}

/**
 * How much effort an application deserves, from its match score (the operator's
 * prompt, 0–10 there): High 75+, Medium 50–74, Quick under 50.
 */
export function effortLevel(score: number): 'High' | 'Medium' | 'Quick' {
  return score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Quick';
}

/** Why a job is still waiting: its last failure note, or what's left to do. */
export function pendingReason(job: Pick<Job, 'status' | 'history'>): string {
  return job.history.findLast((e) => e.note)?.note ?? (job.status === 'found' ? 'Not scored yet' : 'Not drafted yet');
}

/** The toast after Run now: what the run produced, or why it fetched nothing. */
export function runResult(run: RunSummary): string {
  if (run.found === 0 && run.atLimit) return "Nothing was fetched: every source has used today's polls. They poll again tomorrow.";
  if (run.passedFilters === 0) return 'Run finished: nothing new passed your filters.';
  const asked = run.asked ? ` ${run.asked} need${run.asked === 1 ? 's' : ''} your answers in Review.` : '';
  return `Run finished: ${run.passedFilters} job${run.passedFilters === 1 ? '' : 's'} passed your filters, ${run.drafted} drafted.${asked}`;
}

/** One-line summary of the last discovery run for the Review header. */
export function runLine(run: RunSummary | undefined): string {
  if (!run) return 'No runs yet. Run discovery to fill the queue.';
  const when = `Last run ${formatClock(run.at)}`;
  if (run.found === 0 && run.atLimit) return `${when} · every source has used today's polls; they poll again tomorrow`;
  // "New" is jobs no earlier run saw, dropped ones included, so the same filtered-out jobs aren't new every run.
  const line = `${when} · ${run.found} found · ${run.newAfterDedup} new · ${run.passedFilters} passed filters · ${run.drafted} drafted`;
  return run.atLimit ? `${line} · ${run.atLimit} source${run.atLimit === 1 ? '' : 's'} at today's limit` : line;
}

/**
 * Where a draft stands after the operator's decision, read from the send log
 * rather than guessed from the status: Sent is shown only when a sent record
 * exists, and an approved job that didn't go out says so, with why.
 */
export type SendState =
  | { kind: 'waiting' }
  | { kind: 'sent'; line: string; folder?: string }
  | { kind: 'not-sent'; reason: string }
  | { kind: 'unconfirmed'; at: string }
  | { kind: 'handoff' }
  | { kind: 'applied-manually' }
  | { kind: 'skipped' };

export function sendState(job: Job, send: SendRecord | null): SendState {
  if (job.status === 'skipped') return { kind: 'skipped' };
  if (send?.state === 'sent') {
    const when = ` at ${formatClock(send.at)}`;
    const line = send.channel === 'email' ? `Sent to ${send.to}${when}.` : `Form submitted${when}.`;
    const folder = job.folderPath?.split('/').filter(Boolean).at(-1);
    return { kind: 'sent', line, ...(folder ? { folder } : {}) };
  }
  if (send?.state === 'sending') return { kind: 'unconfirmed', at: send.at };
  if (job.status === 'approved') {
    if (!sendsOnApprove(job.channel)) return { kind: 'handoff' };
    // The latest note since approval says why: a refused send, or a form handed back to the operator.
    const since = job.history.findLastIndex((e) => e.status === 'approved' && !e.note);
    const note = job.history.slice(Math.max(since, 0)).findLast((e) => e.note)?.note;
    return { kind: 'not-sent', reason: note ? note.replace(/^Not sent: /, '') : "It hasn't gone out yet." };
  }
  if (job.status === 'drafted' || job.status === 'found' || job.status === 'scored') return { kind: 'waiting' };
  return { kind: 'applied-manually' };
}

/**
 * What stops an email draft from sending, said before the operator clicks: Gmail
 * not set up, or its last sign-in rejected. An offline check isn't a problem yet.
 */
export function gmailIssue(settings: Pick<Settings, 'gmailAddress' | 'secretsSet' | 'checks'>): { message: string; action: string } | undefined {
  if (!settings.gmailAddress || !settings.secretsSet.gmailAppPassword) return { message: "Gmail isn't set up, so approving can't send this email.", action: 'Set up Gmail to send' };
  const check = settings.checks.gmail;
  if (check && !check.ok && !check.offline) return { message: `Gmail can't sign in with the saved app password, so approving can't send this email. ${check.message}`, action: 'Fix Gmail to send' };
  return undefined;
}

/**
 * The trace line over the documents. It claims only what the draft check proved:
 * "Every claim traced" needs a clean check of an unedited letter; anything else
 * says what's unchecked or wrong, never a constant (QA 2026-11-07 #10).
 */
export function traceLine(draft: Pick<Draft, 'edited' | 'check'>, factsUsed: number): { text: string; ok: boolean } {
  const check = draft.check;
  if (check?.placeholders?.length) return { text: `Replace ${check.placeholders.join(', ')} before sending`, ok: false };
  if (check?.forbidden.length) return { text: `Uses ${check.forbidden.map((t) => `"${t}"`).join(', ')}, which your notes for Claude forbid`, ok: false };
  if (draft.edited) return { text: 'Résumé traced to facts · letter edited by you, not checked', ok: false };
  if (!check) return { text: 'Résumé traced to facts · cover letter not checked', ok: false };
  const n = check.unverified.length;
  if (n) return { text: `Résumé traced to facts · cover letter: ${n} unverified line${n === 1 ? '' : 's'}`, ok: false };
  return { text: `Every claim traced to your fact bank · ${factsUsed} facts used`, ok: true };
}

/**
 * Whether a draft's PDFs are on disk. Claude marks a job drafted mid-turn and the files
 * are printed after, so a fresh draft shows "saving" (Approve waits) rather than letting
 * a click fail; a failed save shows its reason.
 */
export function filesState(job: Pick<Job, 'folderPath' | 'history'>): { kind: 'ready' } | { kind: 'saving' } | { kind: 'failed'; reason: string } {
  if (job.folderPath) return { kind: 'ready' };
  const failed = job.history.findLast((e) => e.note?.startsWith("Couldn't save the files"))?.note;
  return failed ? { kind: 'failed', reason: failed } : { kind: 'saving' };
}

/** Which of the queue's filters a group sits under. */
export type QueueFilter = 'attention' | 'send' | 'handoff';

export interface QueueGroup {
  key: 'unsent' | 'asking' | 'drafting' | 'send' | 'handoff';
  label: string;
  filter: QueueFilter;
  jobs: Job[];
}

/**
 * The Review queue grouped by what the operator does next, most urgent first:
 * approved but not sent, Claude's questions, drafting now, then drafts to send
 * and drafts to hand off. Each group is best match first; empty groups are left out.
 */
export function queueGroups(queue: readonly Job[], asking: readonly Job[], drafting: readonly Job[]): QueueGroup[] {
  const best = (jobs: readonly Job[]) => [...jobs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const drafted = queue.filter((j) => j.status !== 'approved');
  const groups: QueueGroup[] = [
    { key: 'unsent', label: 'Approved, not sent', filter: 'attention', jobs: best(queue.filter((j) => j.status === 'approved')) },
    { key: 'asking', label: 'Needs your answers', filter: 'attention', jobs: best(asking) },
    { key: 'drafting', label: 'Drafting now', filter: 'attention', jobs: best(drafting) },
    { key: 'send', label: 'Ready to send', filter: 'send', jobs: best(drafted.filter((j) => sendsOnApprove(j.channel))) },
    { key: 'handoff', label: 'To hand off', filter: 'handoff', jobs: best(drafted.filter((j) => !sendsOnApprove(j.channel))) },
  ];
  return groups.filter((g) => g.jobs.length > 0);
}
