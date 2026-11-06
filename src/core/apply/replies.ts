import type { JobStatus } from '../../shared/types';
import { companyKey } from '../triage/words';

/** An email from the inbox, as read; nothing of it is kept unless it matches an application. */
export interface IncomingMail {
  /** The sender's address. */
  from: string;
  fromName: string;
  subject: string;
  date: string;
  inReplyTo?: string;
  references: string[];
  /** The plain-text body. */
  text: string;
}

/** An application a reply could belong to. */
export interface Application {
  id: string;
  company: string;
  /** The email address (or ATS host) it went to. */
  applyTarget: string;
  /** Message-IDs of the emails Applio sent for it. */
  messageIds: string[];
  status: JobStatus;
}

/** Still waiting on, or talking with, the company: a reply can move these on. */
const OPEN: readonly JobStatus[] = ['applied', 'replied', 'interview'];
/** Shared mailbox domains say nothing about which company wrote. */
const WEBMAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com', 'aol.com']);

const domainOf = (address: string) => address.split('@')[1]?.toLowerCase() ?? '';
/** "Acme, Inc." → "acme": the company as one lowercase word, to look for in a domain. */
const compact = (company: string) => companyKey(company).replace(/[^a-z0-9]/g, '');
/** Lowercase words separated by single spaces, for whole-word matching. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Which application an email answers (SPEC F7): the thread first (In-Reply-To or
 * References name a message Applio sent), then the domain of the address the
 * application went to, then the company's name in the sender's domain or name.
 * @returns The job id, or undefined; unmatched mail is ignored.
 */
export function matchReply(mail: IncomingMail, applications: readonly Application[]): string | undefined {
  const open = applications.filter((a) => OPEN.includes(a.status));
  const thread = new Set([mail.inReplyTo, ...mail.references].filter(Boolean));
  const byThread = open.find((a) => a.messageIds.some((id) => thread.has(id)));
  if (byThread) return byThread.id;

  const domain = domainOf(mail.from);
  if (!domain || WEBMAIL.has(domain)) return undefined;
  const byDomain = open.find((a) => a.applyTarget.includes('@') && domainOf(a.applyTarget) === domain);
  if (byDomain) return byDomain.id;

  // Whole words only: "Metabase Team" must not match Meta.
  const nameWords = ` ${words(mail.fromName)} `;
  return open.find((a) => {
    const key = compact(a.company);
    return key.length >= 3 && (domain.split('.').some((part) => part === key) || nameWords.includes(` ${words(companyKey(a.company))} `));
  })?.id;
}

// "Unfortunately" alone isn't a rejection ("unfortunately that time doesn't work"); it needs a refusal right after.
const REJECTED = /unfortunately\b[^.!?]{0,80}\b(not|other candidates|decided|unable|won't)\b|not (be )?moving forward|move forward with other|decided to (pursue|proceed with) other|regret to inform|position has been filled|no longer (being )?considered|will not be progressing/i;
const INTERVIEW = /\binterview\b|schedule (a |an )?(call|chat|time)|your availability|calendly\.com|book a (time|slot)|next steps? (is|would be) a (call|chat)/i;

/**
 * What a reply means, by keyword rules (SPEC F7; no tokens spent). A rejection
 * wins over an interview mention ("thanks for interviewing, unfortunately…").
 */
export function classifyReply(mail: IncomingMail): Extract<JobStatus, 'replied' | 'interview' | 'rejected'> {
  const text = `${mail.subject}\n${mail.text}`;
  if (REJECTED.test(text)) return 'rejected';
  if (INTERVIEW.test(text)) return 'interview';
  return 'replied';
}

/** The reply's first new lines (no quoted history), at most 200 characters: all Applio keeps of it. */
export function replySummary(mail: IncomingMail): string {
  const fresh: string[] = [];
  for (const line of mail.text.split(/\r?\n/)) {
    if (/^On .+wrote:$/.test(line.trim()) || /^-{2,}\s*$/.test(line.trim()) || /^_{5,}/.test(line)) break;
    if (!line.trim().startsWith('>')) fresh.push(line.trim());
  }
  const summary = fresh.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return (summary || mail.subject).slice(0, 200);
}
