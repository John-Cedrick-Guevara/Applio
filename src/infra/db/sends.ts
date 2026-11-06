import type { DatabaseSync } from 'node:sqlite';
import type { SentRecord } from '../../core/apply/send-application';
import type { ApplyChannel } from '../../shared/types';
import { json, optText, type Row } from './rows';

export type { SentRecord };

export type SendRow =
  | { jobId: string; channel: ApplyChannel; state: 'sending'; at: string }
  | ({ jobId: string; channel: ApplyChannel; state: 'sent' } & SentRecord);

export interface SendsRepo {
  /** Claims the job for sending. @throws when it was claimed or sent before: the double-send guard. */
  claim(jobId: string, channel: ApplyChannel, at: string): void;
  markSent(jobId: string, record: SentRecord): void;
  /** Drops a claim whose send failed, so it can be retried. */
  release(jobId: string): void;
  get(jobId: string): SendRow | undefined;
  /** Claims and sends on a channel at or after `since`, for the daily caps. */
  countSince(channel: ApplyChannel, since: string): number;
}

const toRow = (r: Row): SendRow => {
  const base = { jobId: String(r.job_id), channel: String(r.channel) as ApplyChannel };
  if (r.state === 'sending') return { ...base, state: 'sending', at: String(r.claimed_at) };
  return {
    ...base, state: 'sent', to: String(r.recipient), subject: String(r.subject), body: String(r.body),
    attachments: json<string[]>(r.attachments), at: optText(r.sent_at) ?? String(r.claimed_at),
  };
};

/** SQLite-backed send log. The job id is the primary key, so a second claim can't succeed. */
export function createSendsRepo(db: DatabaseSync): SendsRepo {
  const insert = db.prepare("INSERT INTO sends (job_id, channel, state, claimed_at) VALUES (?, ?, 'sending', ?)");
  const sent = db.prepare("UPDATE sends SET state = 'sent', sent_at = ?, recipient = ?, subject = ?, body = ?, attachments = ? WHERE job_id = ?");
  const remove = db.prepare("DELETE FROM sends WHERE job_id = ? AND state = 'sending'");
  const select = db.prepare('SELECT * FROM sends WHERE job_id = ?');
  const count = db.prepare('SELECT COUNT(*) AS n FROM sends WHERE channel = ? AND claimed_at >= ?');
  return {
    claim: (jobId, channel, at) => void insert.run(jobId, channel, at),
    markSent: (jobId, r) => void sent.run(r.at, r.to, r.subject, r.body, JSON.stringify(r.attachments), jobId),
    release: (jobId) => void remove.run(jobId),
    get: (jobId) => {
      const r = select.get(jobId);
      return r ? toRow(r) : undefined;
    },
    countSince: (channel, since) => Number(count.get(channel, since)?.n ?? 0),
  };
}
