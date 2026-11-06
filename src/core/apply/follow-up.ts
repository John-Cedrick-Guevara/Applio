import type { Job } from '../../shared/types';
import { fromHeader, SendBlockedError, type EmailMessage } from './send-application';

export interface FollowUpPorts {
  job: (id: string) => Job;
  /** The original application email's subject and Message-ID, from the send log. */
  sent: (id: string) => { subject: string; messageId?: string } | undefined;
  sendEmail: (message: EmailMessage) => Promise<void>;
  owner: () => { name: string; email: string };
  folder: (job: Job) => string | undefined;
  appendFile: (path: string, text: string) => void;
  /** Adds the "Follow-up sent" event, which restarts the follow-up window. */
  logFollowUp: (id: string) => Job;
  newMessageId: (jobId: string) => string;
  now: () => Date;
}

/**
 * Sends the operator's follow-up (SPEC F7) as a reply in the application's
 * email thread, then logs it word for word. Only this function sends a
 * follow-up, and only the operator's click calls it.
 * @throws SendBlockedError when the application isn't waiting, has no email address, or the text is empty.
 */
export async function sendFollowUp(jobId: string, text: string, ports: FollowUpPorts): Promise<Job> {
  const job = ports.job(jobId);
  if (job.status !== 'applied') throw new SendBlockedError('Follow-ups go only to applications still waiting on a reply');
  if (!text.trim()) throw new SendBlockedError('Write the follow-up first');
  if (job.channel !== 'email') throw new SendBlockedError('This application went through a form, so there is no email address to follow up with.');

  const original = ports.sent(jobId);
  const { name, email } = ports.owner();
  const subject = `Re: ${original?.subject ?? `Application: ${job.title}`}`;
  await ports.sendEmail({
    from: fromHeader(name, email),
    to: job.applyTarget,
    subject,
    text,
    attachments: [],
    messageId: ports.newMessageId(jobId),
    ...(original?.messageId ? { inReplyTo: original.messageId, references: original.messageId } : {}),
  });

  const folder = ports.folder(job);
  if (folder) ports.appendFile(`${folder.replace(/\/+$/, '')}/follow-ups.md`, `\n## ${ports.now().toISOString()}\nTo: ${job.applyTarget}\nSubject: ${subject}\n\n${text}\n`);
  return ports.logFollowUp(jobId);
}
