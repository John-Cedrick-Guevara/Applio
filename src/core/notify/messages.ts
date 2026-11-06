import type { Job } from '../../shared/types';

/** A Telegram message: text plus optional rows of buttons, each carrying `<action>:<jobId>`. */
export interface BotMessage {
  text: string;
  buttons?: { text: string; data: string }[][];
}

const headline = (job: Pick<Job, 'title' | 'company'>) => `${job.title} at ${job.company}`;

// Summaries only: no letter, résumé or answer text ever leaves for Telegram (spec Decisions).

export const newMatch = (job: Job): BotMessage => ({
  text: `New match · ${job.score ?? 0}%\n${headline(job)}${job.roleSummary ? `\n${job.roleSummary}` : ''}`,
});

export const draftReady = (job: Job): BotMessage => ({
  text: `Draft ready · ${job.score ?? 0}%\n${headline(job)}\nApprove to send it, or open it in Applio first.`,
  buttons: [[{ text: 'Approve', data: `approve:${job.id}` }, { text: 'Open', data: `open:${job.id}` }, { text: 'Skip', data: `skip:${job.id}` }]],
});

export const sentOnItsOwn = (job: Job): BotMessage => ({ text: `Sent on its own · ${job.score ?? 0}%\n${headline(job)}` });

export const replyArrived = (job: Job, note: string): BotMessage => ({ text: `Reply · ${headline(job)}\n${note}` });

export const followUpDue = (job: Job, days: number): BotMessage => ({
  text: `Follow-up due · ${headline(job)}\nNo reply in ${days} days. Draft a follow-up in Applio.`,
  buttons: [[{ text: 'Open', data: `open:${job.id}` }]],
});

export const quotaWarning = (message: string): BotMessage => ({ text: `Budget · ${message}` });
