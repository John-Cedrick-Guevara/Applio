import { capAutonomy, maxAutonomyFor } from '../../../shared/autonomy';
import type { ApplyChannel, Autonomy, Draft, Job, SendRecord, Settings } from '../../../shared/types';
import { formatClock } from '../../lib/format';
import { filesState } from '../../lib/job-progress';
import { AUTONOMY_LABEL, LIFECYCLE } from '../../lib/labels';

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

export type InboxTabKey = 'fix' | 'answer' | 'approve' | 'handoff';
export type InboxSort = 'score' | 'oldest';

export interface InboxTab {
  key: InboxTabKey;
  label: string;
  /** One line under the tabs saying what's in this one. */
  hint: string;
  jobs: Job[];
}

/** When a job first reached Applio, for "oldest first". */
const foundAt = (job: Job) => job.history[0]?.at ?? job.postedAt;

/**
 * The Inbox (redesign v2): only jobs waiting on a decision, each in exactly one
 * tab, most urgent tab first. Fix first holds approved jobs that didn't send and
 * suspicious posts; Approve holds drafts that send on approval; Hand off holds the
 * ones the operator applies to. Every tab is kept, even empty, so counts don't jump.
 */
export function inboxTabs(queue: readonly Job[], asking: readonly Job[], sort: InboxSort): InboxTab[] {
  const order = (jobs: Job[]) => jobs.sort(sort === 'oldest' ? (a, b) => foundAt(a).localeCompare(foundAt(b)) : (a, b) => (b.score ?? 0) - (a.score ?? 0));
  const fix = (j: Job) => !!j.suspicious || (j.status === 'approved' && sendsOnApprove(j.channel));
  // A job skipped or sent on this visit stays in the page's data until it reloads; it's no longer a decision.
  queue = queue.filter((j) => j.status === 'drafted' || j.status === 'approved');
  return [
    { key: 'fix', label: 'Fix first', hint: 'Sends that failed and posts to check. Handle these first.', jobs: order(queue.filter(fix)) },
    { key: 'answer', label: 'Answer', hint: "Claude asked before drafting. Answers are saved for every job.", jobs: order([...asking]) },
    { key: 'approve', label: 'Approve', hint: 'Drafts ready to send. Nothing here goes out without your click.', jobs: order(queue.filter((j) => !fix(j) && sendsOnApprove(j.channel))) },
    { key: 'handoff', label: 'Hand off', hint: 'Sites you apply on yourself, with everything to copy.', jobs: order(queue.filter((j) => !fix(j) && !sendsOnApprove(j.channel))) },
  ];
}

export type StepState = 'done' | 'current' | 'blocked' | 'failed' | 'todo';
/**
 * Where a job is between New and Sent, read from its records: the step it's on is
 * in progress (`current`), waiting on the operator (`blocked`: a scan, Claude's
 * questions, a draft click, approval) or `failed`. Drafted stays in progress until
 * the PDFs are saved. Sent is done only past Approved; an approved job with no sent
 * record shows Sent as failed.
 */
export function jobSteps(
  job: Job,
  { drafting = false, send = null, saving = true }: { drafting?: boolean; send?: SendRecord | null; saving?: boolean } = {},
): { label: string; state: StepState }[] {
  const at = (index: number, state: StepState) => LIFECYCLE.map((label, i) => ({ label, state: i < index ? 'done' : i === index ? state : 'todo' } as const));
  switch (job.status) {
    case 'found':
      return at(1, 'blocked');
    case 'scored':
      return at(2, drafting ? 'current' : 'blocked');
    case 'drafted': {
      const files = filesState(job, saving);
      return files.kind === 'ready' ? at(3, 'blocked') : at(2, files.kind === 'failed' ? 'failed' : 'current');
    }
    case 'approved': {
      const state = sendState(job, send);
      return state.kind === 'sent' ? at(5, 'done') : at(4, state.kind === 'not-sent' ? 'failed' : 'blocked');
    }
    case 'skipped':
      return at(2, 'todo');
    default:
      return at(5, 'done');
  }
}
