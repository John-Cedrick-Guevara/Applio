import type { Draft, Job, SendRecord } from '../../../shared/types';
import type { Tone } from '../../components/job-state';
import { filesState } from '../../lib/job-progress';
import { sendState, sendsOnApprove } from './review-model';

/** One state a job's card can show: a bold title (what's true) and one sentence (why, and what was kept). */
export interface CardState<K extends string = string> {
  kind: K;
  tone: Exclude<Tone, 'neutral'> | 'neutral';
  title: string;
  body: string;
}

export type DraftCardKind =
  | 'send-error' | 'suspicious' | 'files-failed' | 'setup' | 'placeholders' | 'stale' | 'saving' | 'ready'
  | 'not-sent' | 'unconfirmed' | 'handed-off' | 'sent' | 'applied' | 'skipped';

interface DraftCardInput {
  job: Job;
  draft: Draft | null;
  send: SendRecord | null;
  /** The last Approve's error while the job is still drafted (a send refused before the status moved). */
  sendError?: string;
  /** Why an email can't send right now, from `gmailIssue`. */
  gmailIssue?: { message: string };
}

/**
 * The one state a draft's card shows, and the titles of every other state that
 * also applies (folded under "More notes"). While the job waits on the operator,
 * the most urgent state wins: a failed send, a suspicious post, failed PDFs, then
 * what's wrong in the draft (placeholders, an older profile) before what's wrong
 * with the channel (Gmail not ready), then PDFs saving, then ready. After a
 * decision the send log decides (`sendState`), so Sent needs a sent record.
 */
export function draftCard({ job, draft, send, sendError, gmailIssue }: DraftCardInput): { card: CardState<DraftCardKind>; notes: string[] } {
  if (job.status !== 'drafted') return { card: decidedCard(job, send), notes: [] };

  const files = filesState(job);
  const placeholders = draft?.check?.placeholders ?? [];
  const candidates: (CardState<DraftCardKind> | false)[] = [
    !!sendError && { kind: 'send-error', tone: 'failed', title: 'Not sent.', body: `${sendError} Nothing went out, and the draft is still here.` },
    !!job.suspicious && {
      kind: 'suspicious', tone: 'failed', title: "This post looks like it's trying to manipulate automated tools.",
      body: `${job.suspicious} Verify the company is real before sending. Applio only ever sends to ${job.applyTarget}.`,
    },
    files.kind === 'failed' && {
      kind: 'files-failed', tone: 'failed', title: "PDFs didn't save:",
      body: `${files.reason.replace(/^Couldn't save the files: /, '')}. The draft is safe, and retrying costs no tokens.`,
    },
    placeholders.length > 0 && { kind: 'placeholders', tone: 'needs', title: 'Replace the placeholders first.', body: `The letter still has ${placeholders.join(', ')}.` },
    !!draft?.check?.stale && {
      kind: 'stale', tone: 'needs', title: 'Made from an older profile.',
      body: 'Your facts, contact details or notes for Claude changed since this was drafted, so it may say something no longer true.',
    },
    job.channel === 'email' && !!gmailIssue && { kind: 'setup', tone: 'needs', title: "Gmail isn't ready.", body: gmailIssue.message },
    files.kind === 'saving' && { kind: 'saving', tone: 'busy', title: 'Saving the résumé and letter PDFs.', body: "Claude's draft is saved; the PDFs are printing." },
  ];
  const applies = candidates.filter((c): c is CardState<DraftCardKind> => !!c);
  const [card = readyCard(job), ...rest] = applies;
  return { card, notes: rest.map((c) => c.title) };
}

/** Nothing stands in the way: the draft waits for the operator's decision. */
function readyCard(job: Job): CardState<DraftCardKind> {
  if (!sendsOnApprove(job.channel)) {
    return { kind: 'ready', tone: 'neutral', title: 'Ready for you to apply.', body: 'This site is applied to by hand. Open the handoff for the résumé, letter and answers to copy.' };
  }
  return { kind: 'ready', tone: 'done', title: 'Ready to approve.', body: 'The résumé and letter PDFs are saved.' };
}

/** Where the job stands after the operator's decision, read from the send log. */
function decidedCard(job: Job, send: SendRecord | null): CardState<DraftCardKind> {
  const state = sendState(job, send);
  switch (state.kind) {
    case 'sent':
      return { kind: 'sent', tone: 'done', title: state.line, body: state.folder ? `Saved to ${state.folder}.` : 'What went out is saved in Applications.' };
    case 'not-sent':
      return { kind: 'not-sent', tone: 'failed', title: job.channel === 'email' ? 'Not sent.' : 'Not submitted.', body: state.reason };
    case 'unconfirmed':
      return { kind: 'unconfirmed', tone: 'needs', title: "Can't tell whether it went out.", body: job.channel === 'email' ? "A send started but never confirmed. Check Gmail's Sent folder." : 'A submit started but never confirmed. Check the form window and your email.' };
    case 'handoff':
      return { kind: 'handed-off', tone: 'neutral', title: 'Approved. Apply by hand.', body: 'It waits for you in the handoff.' };
    case 'skipped':
      return { kind: 'skipped', tone: 'neutral', title: 'Skipped.', body: 'Nothing was sent.' };
    case 'applied-manually':
      return { kind: 'applied', tone: 'done', title: 'You applied to this one yourself.', body: 'It is tracked in Applications.' };
    case 'waiting':
      return readyCard(job);
  }
}

/**
 * What Applio will or won't do with the job on its own. Auto-send only runs right
 * after a draft is made, so a draft that is still waiting never goes out without a
 * click; when it was held, the saved "Not sent automatically" note says why.
 */
export function nextLine(job: Job, send: SendRecord | null): string {
  if (job.status !== 'drafted') {
    switch (sendState(job, send).kind) {
      case 'sent':
      case 'applied-manually':
        return 'Applio watches your inbox for a reply and lists it in Applications.';
      case 'not-sent':
        return 'It stays in Review until it sends or you skip it.';
      case 'unconfirmed':
        return 'Nothing, until you say whether it went out.';
      case 'handoff':
        return 'Never sent by Applio. Apply on the site, then mark it applied.';
      case 'skipped':
        return 'Nothing. It stays out of your queue and future scans.';
    }
  }
  if (!sendsOnApprove(job.channel)) return 'Never sent by Applio. Open the handoff, apply on the site, then mark it applied.';
  if (job.suspicious) return 'Never sends on its own because the post looks suspicious. It waits for your approval.';
  const held = job.history.findLast((e) => e.note?.startsWith('Not sent automatically: '))?.note?.slice('Not sent automatically: '.length);
  if (held) return `Waits for your approval. It didn't send on its own: ${held.charAt(0).toLowerCase()}${held.slice(1)}`;
  return `Waits for your approval. Approving ${job.channel === 'email' ? 'sends it to' : 'submits the form at'} ${job.applyTarget}.`;
}

export type UndraftedCardKind = 'budget' | 'draft-failed' | 'to-draft' | 'below' | 'unscored';

/**
 * The card for a job with no draft yet: why it has none and what gets it one.
 * A used-up budget wins, since no draft can start until it resets.
 */
export function undraftedCard(job: Job, { draftBar, budgetStop }: { draftBar: number; budgetStop?: string }): CardState<UndraftedCardKind> {
  if (job.status !== 'scored') {
    const note = job.history.findLast((e) => e.note)?.note;
    return { kind: 'unscored', tone: 'needs', title: 'Not scored yet.', body: note ? `${note} Your next scan scores it.` : 'Your next scan scores it.' };
  }
  if (budgetStop) return { kind: 'budget', tone: 'needs', title: "Can't draft today.", body: budgetStop };
  const score = job.score ?? 0;
  const failed = job.history.findLast((e) => e.note?.startsWith('Not drafted'))?.note;
  if (score >= draftBar && failed) return { kind: 'draft-failed', tone: 'failed', title: 'The draft failed.', body: `${failed} Draft it again when you're ready.` };
  if (score >= draftBar) return { kind: 'to-draft', tone: 'neutral', title: 'Strong match, not drafted yet.', body: `Its match score (${score}) is at or above your draft bar (${draftBar}). Scans only draft when you ask.` };
  return { kind: 'below', tone: 'neutral', title: 'Below your draft bar.', body: `Its match score (${score}) is below your draft bar (${draftBar}). Draft it anyway if it looks right.` };
}
