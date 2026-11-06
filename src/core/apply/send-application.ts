import { AppError } from '../../shared/errors';
import type { ApplyChannel, Draft, Job, JobStatus, SentBy } from '../../shared/types';

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
}

/** What went out, exactly as sent (SPEC F7). */
export interface SentRecord {
  to: string;
  subject: string;
  body: string;
  attachments: string[];
  at: string;
}

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
  writeFile: (path: string, text: string) => void;
  owner: () => { name: string; email: string };
  caps: () => { gmailDaily: number; perChannel: number };
  /** The operator's local midnight (ISO), where daily caps reset. */
  dayStart: () => string;
  now: () => Date;
  /** Adds answers the operator just approved to the answer bank. */
  saveAiAnswers: (answers: { question: string; answer: string }[]) => void;
}

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

/**
 * Sends one job's application by email (SPEC F5 channel 1) and logs exactly what
 * went out. The send log is claimed first, so a double click or a second caller
 * can't send twice; a failure releases it for a retry, while a claim left by a
 * crash blocks any resend, since the email may already be out.
 * @throws SendBlockedError for caps, a missing résumé or an unfinished earlier send; the SMTP error when Gmail refuses.
 */
export async function sendByEmail(jobId: string, sentBy: SentBy, ports: ApplyPorts): Promise<Job> {
  const job = ports.job(jobId);
  const draft = ports.draft(jobId);
  if (!draft) throw new SendBlockedError(`Job ${jobId} has no draft to send.`);

  const earlier = ports.sendLog.get(jobId);
  if (earlier?.state === 'sent') throw new SendBlockedError(`This application was already sent at ${earlier.at}.`);
  if (earlier?.state === 'sending') {
    throw new SendBlockedError(
      `A send started at ${earlier.at} didn't finish, so Applio can't tell whether it went out. Check Gmail's Sent folder, then use Mark as applied or I didn't apply.`,
    );
  }

  const today = ports.sendLog.countSince('email', ports.dayStart());
  const { gmailDaily, perChannel } = ports.caps();
  if (today >= gmailDaily) throw new SendBlockedError(`Gmail's daily cap is reached (${gmailDaily} sends today). Applio sends again tomorrow.`);
  if (today >= perChannel) throw new SendBlockedError(`Today's cap for email applications is reached (${perChannel}). Raise it in Guardrails, or send tomorrow.`);

  const folder = ports.folder(job);
  const resume = folder ? join(folder, 'resume.pdf') : undefined;
  if (!folder || !resume || !ports.fileExists(resume)) {
    throw new SendBlockedError("The résumé PDF isn't saved yet, so there's nothing to attach. Open the job folder to check it.");
  }

  const { name, email } = ports.owner();
  const message: EmailMessage = {
    // Quoted, so a comma or other address character in the name can't split it into two addresses.
    from: name ? `"${name.replace(/["\\]/g, '')}" <${email}>` : email,
    to: job.applyTarget,
    subject: name ? `Application: ${job.title} — ${name}` : `Application: ${job.title}`,
    text: draft.coverLetter,
    attachments: [{ filename: 'resume.pdf', path: resume }],
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

  const record: SentRecord = { to: message.to, subject: message.subject, body: message.text, attachments: ['resume.pdf'], at: ports.now().toISOString() };
  ports.sendLog.markSent(jobId, record);
  const applied = ports.transition(jobId, 'applied', { sentBy });
  try {
    ports.writeFile(join(folder, 'sent.md'), sentMarkdown(applied, record));
  } catch (err) {
    // The email is out and logged in the database; a missing sent.md mustn't make it look unsent.
    ports.note(jobId, `Sent, but sent.md couldn't be written: ${err instanceof Error ? err.message : String(err)}`);
  }
  return applied;
}

/**
 * The operator approves a draft (SPEC F5): the job becomes Approved, its new
 * AI-written answers join the answer bank, and an email job is sent. ATS jobs
 * wait for PR-19; platform and career-site jobs go to the manual handoff and
 * are never sent from here.
 */
export async function approveDraft(jobId: string, ports: ApplyPorts): Promise<Job> {
  let job = ports.job(jobId);
  if (job.status !== 'drafted' && job.status !== 'approved') throw new SendBlockedError(`Job ${jobId} is not awaiting approval`);
  if (job.status === 'drafted') {
    job = ports.transition(jobId, 'approved');
    const fresh = (ports.draft(jobId)?.answers ?? []).filter((a) => a.origin === 'ai').map(({ question, answer }) => ({ question, answer }));
    if (fresh.length > 0) ports.saveAiAnswers(fresh);
  }
  return job.channel === 'email' ? sendByEmail(jobId, 'you-app', ports) : job;
}
