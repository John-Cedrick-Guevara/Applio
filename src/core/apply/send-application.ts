import { AppError } from '../../shared/errors';
import type { ApplyChannel, Draft, Job, JobStatus, SentBy } from '../../shared/types';
import type { FillInput, FillStep } from './ats-plan';
import { atsFormUrl } from './channel';

/** A send that can't happen now: a cap, a missing file, or an earlier send. The job keeps its status. */
export class SendBlockedError extends AppError {
  constructor(message: string) {
    super('send_blocked', message);
  }
}

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  attachments: { filename: string; path: string }[];
  /** Set on every email Applio sends, so replies and follow-ups thread to it. */
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

/** What went out, exactly as sent (SPEC F7). */
export interface SentRecord {
  to: string;
  subject: string;
  body: string;
  attachments: string[];
  at: string;
  /** The email's Message-ID, for threading follow-ups and matching replies. */
  messageId?: string;
}

/** How an attempt at an ATS form ended. Only `submitted` was seen to go through. */
export type AtsOutcome =
  /** `screenshot`: a PNG of the confirmation page, kept in the job folder as proof. */
  | { kind: 'submitted'; filled: FillStep[]; screenshot?: Uint8Array }
  /** Not submitted: a CAPTCHA, a question without a saved answer, or no form found. The window is left to the operator. */
  | { kind: 'handoff'; reason: string }
  /** Submit was pressed but no confirmation showed, so it may or may not have gone through. */
  | { kind: 'unconfirmed'; filled: FillStep[] };

export type SendLogRow = { state: 'sending'; channel: ApplyChannel; at: string } | ({ state: 'sent'; channel: ApplyChannel } & SentRecord);

export interface ApplyPorts {
  job: (id: string) => Job;
  draft: (id: string) => Draft | undefined;
  transition: (id: string, status: JobStatus, extra?: { sentBy?: SentBy; note?: string }) => Job;
  note: (id: string, text: string) => void;
  /** The double-send guard: one row per job, claimed before sending. */
  sendLog: {
    get: (id: string) => SendLogRow | undefined;
    /** @throws when the job was claimed before. */
    claim: (id: string, channel: ApplyChannel, at: string) => void;
    markSent: (id: string, record: SentRecord) => void;
    release: (id: string) => void;
    countSince: (channel: ApplyChannel, since: string) => number;
  };
  /** @throws with an operator-readable message when Gmail refuses or can't be reached. */
  sendEmail: (message: EmailMessage) => Promise<void>;
  /** The job's folder on disk, re-linked if moved. */
  folder: (job: Job) => string | undefined;
  fileExists: (path: string) => boolean;
  writeFile: (path: string, content: string | Uint8Array) => void;
  owner: () => { name: string; email: string };
  caps: () => { gmailDaily: number; perChannel: number };
  /** The operator's local midnight (ISO), where daily caps reset. */
  dayStart: () => string;
  now: () => Date;
  newMessageId: (jobId: string) => string;
  /** Adds answers the operator just approved to the answer bank. */
  saveAiAnswers: (answers: { question: string; answer: string }[]) => void;
  bankAnswers: () => { question: string; answer: string }[];
  /** Fills and submits an ATS form in Applio's own window (SPEC F5 channel 2); hidden for autonomous sends. */
  submitAts: (request: { url: string; input: FillInput; visible: boolean }) => Promise<AtsOutcome>;
}

/** The From header: the name quoted, so a comma or other address character in it can't split it into two addresses. */
export const fromHeader = (name: string, email: string) => (name ? `"${name.replace(/["\\]/g, '')}" <${email}>` : email);

const join = (dir: string, file: string) => `${dir.replace(/\/+$/, '')}/${file}`;

/** `sent.md`: what was submitted, the channel, the time and the tokens (SPEC F8). */
export function sentMarkdown(job: Job, r: SentRecord): string {
  return `# Sent: ${job.title} — ${job.company}

To: ${r.to}
Subject: ${r.subject}
Channel: ${job.channel}
Sent: ${r.at}
Tokens: ${job.tokensUsed}
Attachments: ${r.attachments.join(', ')}

## Body
${r.body}
`;
}

const CHANNEL_NAME: Record<ApplyChannel, string> = { email: 'email', ats: 'ATS', platform: 'platform', custom: 'career-site' };

/**
 * The checks every send makes first: a draft, no earlier or unfinished send, the
 * daily caps, and a saved résumé. A claim left by a crash blocks any resend,
 * since the application may already be out.
 * @throws SendBlockedError naming what's in the way.
 */
const readyToSend = (jobId: string, channel: ApplyChannel, ports: ApplyPorts) => {
  const job = ports.job(jobId);
  const draft = ports.draft(jobId);
  if (!draft) throw new SendBlockedError(`Job ${jobId} has no draft to send.`);

  const earlier = ports.sendLog.get(jobId);
  if (earlier?.state === 'sent') throw new SendBlockedError(`This application was already sent at ${earlier.at}.`);
  if (earlier?.state === 'sending') {
    const check = channel === 'email' ? "Check Gmail's Sent folder" : 'Check the form window and your email';
    throw new SendBlockedError(`A send started at ${earlier.at} didn't finish, so Applio can't tell whether it went out. ${check}, then use Mark as applied or I didn't apply.`);
  }

  const today = ports.sendLog.countSince(channel, ports.dayStart());
  const { gmailDaily, perChannel } = ports.caps();
  if (channel === 'email' && today >= gmailDaily) throw new SendBlockedError(`Gmail's daily cap is reached (${gmailDaily} sends today). Applio sends again tomorrow.`);
  if (today >= perChannel) throw new SendBlockedError(`Today's cap for ${CHANNEL_NAME[channel]} applications is reached (${perChannel}). Raise it in Guardrails, or send tomorrow.`);

  const folder = ports.folder(job);
  const resume = folder ? join(folder, 'resume.pdf') : undefined;
  if (!folder || !resume || !ports.fileExists(resume)) {
    throw new SendBlockedError("The résumé PDF isn't saved yet, so there's nothing to attach. Open the job folder to check it.");
  }
  return { job, draft, folder, resume };
};

/** After a confirmed send: the record, the Applied move, and `sent.md`, which can fail without undoing the send. */
const recordSent = (jobId: string, sentBy: SentBy, folder: string, record: SentRecord, ports: ApplyPorts) => {
  ports.sendLog.markSent(jobId, record);
  const applied = ports.transition(jobId, 'applied', { sentBy });
  try {
    ports.writeFile(join(folder, 'sent.md'), sentMarkdown(applied, record));
  } catch (err) {
    // The application is out and logged in the database; a missing sent.md mustn't make it look unsent.
    ports.note(jobId, `Sent, but sent.md couldn't be written: ${err instanceof Error ? err.message : String(err)}`);
  }
  return applied;
};

/**
 * Sends one job's application by email (SPEC F5 channel 1) and logs exactly what
 * went out. The send log is claimed first, so a double click or a second caller
 * can't send twice; a failure releases it for a retry.
 * @throws SendBlockedError for caps, a missing résumé or an unfinished earlier send; the SMTP error when Gmail refuses.
 */
export async function sendByEmail(jobId: string, sentBy: SentBy, ports: ApplyPorts): Promise<Job> {
  const { job, draft, folder, resume } = readyToSend(jobId, 'email', ports);

  const { name, email } = ports.owner();
  const message: EmailMessage = {
    from: fromHeader(name, email),
    to: job.applyTarget,
    subject: name ? `Application: ${job.title} — ${name}` : `Application: ${job.title}`,
    text: draft.coverLetter,
    attachments: [{ filename: 'resume.pdf', path: resume }],
    messageId: ports.newMessageId(jobId),
  };

  ports.sendLog.claim(jobId, 'email', ports.now().toISOString());
  try {
    await ports.sendEmail(message);
  } catch (err) {
    ports.sendLog.release(jobId);
    const reason = err instanceof Error ? err.message : String(err);
    ports.note(jobId, `Not sent: ${reason}`);
    throw err;
  }

  const record: SentRecord = { to: message.to, subject: message.subject, body: message.text, attachments: ['resume.pdf'], at: ports.now().toISOString(), messageId: message.messageId };
  return recordSent(jobId, sentBy, folder, record, ports);
}

/**
 * Fills and submits a standard ATS form (SPEC F5 channel 2) and logs exactly what
 * was filled. A form Applio can't finish (a CAPTCHA, an unanswered question) is
 * handed to the operator and the claim released; a submit that wasn't confirmed
 * keeps the claim, so it's never submitted twice.
 * @throws SendBlockedError for a handoff, an unconfirmed submit, caps, or a missing résumé.
 */
export async function sendByAts(jobId: string, sentBy: SentBy, ports: ApplyPorts): Promise<Job> {
  const { job, draft, folder, resume } = readyToSend(jobId, 'ats', ports);
  if (!job.applyUrl) throw new SendBlockedError("This job has no form link, so Applio can't open its application. Use the manual handoff.");
  const coverLetter = join(folder, 'cover-letter.pdf');
  const url = atsFormUrl(job.applyUrl);
  const input: FillInput = {
    applicant: { fullName: ports.owner().name, email: ports.owner().email },
    files: { resume, ...(draft.kind === 'cover-letter' && ports.fileExists(coverLetter) ? { coverLetter } : {}) },
    letter: draft.coverLetter,
    // The draft's own answers first: they were written for this posting.
    answers: [...draft.answers.map(({ question, answer }) => ({ question, answer })), ...ports.bankAnswers()],
  };

  ports.sendLog.claim(jobId, 'ats', ports.now().toISOString());
  let outcome: AtsOutcome;
  try {
    outcome = await ports.submitAts({ url, input, visible: sentBy !== 'autonomous' });
  } catch (err) {
    ports.sendLog.release(jobId);
    ports.note(jobId, `Not sent: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }

  if (outcome.kind === 'handoff') {
    ports.sendLog.release(jobId);
    ports.note(jobId, `Handed to you: ${outcome.reason}`);
    throw new SendBlockedError(
      sentBy === 'autonomous'
        ? `The form needs you. ${outcome.reason}`
        : `Applio filled what it could. Finish the form in its window, then use Mark as applied. ${outcome.reason}`,
    );
  }
  if (outcome.kind === 'unconfirmed') {
    ports.note(jobId, "Submit was pressed, but no confirmation showed. Check the form window and your email.");
    throw new SendBlockedError("Applio pressed Submit but couldn't confirm it went through. Check the form window and your email, then use Mark as applied or I didn't apply.");
  }

  const files = [resume, input.files.coverLetter].filter(Boolean).map((p) => p!.split('/').at(-1)!);
  const record: SentRecord = {
    to: url,
    subject: `${job.title} application form`,
    body: outcome.filled.map((s) => `${s.label}: ${s.action === 'file' ? s.value.split('/').at(-1) : s.value}`).join('\n'),
    attachments: files,
    at: ports.now().toISOString(),
  };
  const applied = recordSent(jobId, sentBy, folder, record, ports);
  if (outcome.screenshot) {
    try {
      ports.writeFile(join(folder, 'confirmation.png'), outcome.screenshot);
    } catch (err) {
      ports.note(jobId, `Sent, but the confirmation screenshot couldn't be saved: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return applied;
}

/**
 * The operator approves a draft (SPEC F5): the job becomes Approved, its new
 * AI-written answers join the answer bank, and an email or ATS job is sent.
 * Platform and career-site jobs go to the manual handoff and are never sent from here.
 */
export async function approveDraft(jobId: string, ports: ApplyPorts): Promise<Job> {
  let job = ports.job(jobId);
  if (job.status !== 'drafted' && job.status !== 'approved') throw new SendBlockedError(`Job ${jobId} is not awaiting approval`);
  if (job.status === 'drafted') {
    job = ports.transition(jobId, 'approved');
    const fresh = (ports.draft(jobId)?.answers ?? []).filter((a) => a.origin === 'ai').map(({ question, answer }) => ({ question, answer }));
    if (fresh.length > 0) ports.saveAiAnswers(fresh);
  }
  if (job.channel === 'email') return sendByEmail(jobId, 'you-app', ports);
  if (job.channel === 'ats') return sendByAts(jobId, 'you-app', ports);
  return job;
}
