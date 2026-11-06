import { nextStatuses } from '../../shared/status';
import type { JobStatus } from '../../shared/types';
import { classifyReply, matchReply, replySummary, type Application, type IncomingMail } from './replies';

export interface TrackPorts {
  /** Applications a reply could belong to, with the Message-IDs Applio sent for each. */
  applications: () => Application[];
  /** The operator's own address; their own mail is never a reply. */
  ownAddress: string;
  move: (jobId: string, status: JobStatus, note: string, at: string) => void;
  note: (jobId: string, text: string, at: string) => void;
}

/**
 * Applies inbox mail to the application log (SPEC F7): a matched reply moves its
 * application to Replied, Interview or Rejected when the status rules allow, and
 * otherwise just lands on the timeline. Only the sender, the date and a short
 * summary are kept; unmatched mail is dropped untouched.
 * @returns How many emails matched an application.
 */
export function trackReplies(mails: readonly IncomingMail[], ports: TrackPorts): number {
  let matched = 0;
  for (const mail of mails) {
    if (mail.from === ports.ownAddress.toLowerCase()) continue;
    const apps = ports.applications();
    const id = matchReply(mail, apps);
    if (!id) continue;
    matched++;
    const app = apps.find((a) => a.id === id)!;
    const status = classifyReply(mail);
    const note = `Reply from ${mail.from}: ${replySummary(mail)}`;
    if (status !== app.status && nextStatuses(app.status).includes(status)) ports.move(id, status, note, mail.date);
    else ports.note(id, note, mail.date);
  }
  return matched;
}
