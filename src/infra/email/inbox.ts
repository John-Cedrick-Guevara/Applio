import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from 'imapflow';
import type { Readable } from 'node:stream';
import type { IncomingMail } from '../../core/apply/replies';

/** The part of an imapflow client this adapter uses, so tests can pass a fake. */
export type InboxClient = Pick<ImapFlow, 'connect' | 'getMailboxLock' | 'fetch' | 'download' | 'logout'>;

/** Enough of a reply to summarize it; the rest of a long email is never read. */
const MAX_TEXT_BYTES = 16_384;

/** Gmail's IMAP with the app password; read-only access to the inbox. */
export const gmailImap = (auth: { user: string; pass: string }): InboxClient =>
  new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth, logger: false });

/** The plain-text part of a message, if it has one. */
const textPart = (node: MessageStructureObject | undefined): string | undefined => {
  if (!node) return undefined;
  if (node.type === 'text/plain') return node.part ?? '1';
  for (const child of node.childNodes ?? []) {
    const found = textPart(child);
    if (found) return found;
  }
  return undefined;
};

const references = (headers: Buffer | undefined) => (headers?.toString().match(/<[^>\s]+>/g) ?? []);

const readAll = async (stream: Readable) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
};

/**
 * Reads the inbox mail that arrived after `afterUid` (or since `since`, the
 * first time), read-only, for reply tracking (SPEC F7). It returns only what
 * matching needs; the caller keeps nothing of mail that matches no application.
 * @returns The mails and the highest UID seen, for the next read.
 */
export async function readInbox(
  { afterUid, since }: { afterUid?: number; since: Date },
  connect: () => InboxClient,
): Promise<{ mails: IncomingMail[]; lastUid: number }> {
  const client = connect();
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    try {
      const range = afterUid !== undefined ? { uid: `${afterUid + 1}:*` } : { since };
      // Collect first: imapflow can't run another command (download) inside a fetch.
      const fetched: FetchMessageObject[] = [];
      for await (const msg of client.fetch(range, { uid: true, envelope: true, bodyStructure: true, headers: ['references'] }, { uid: true })) {
        // "n:*" always returns the newest message, even when it's older than n.
        if (afterUid === undefined || msg.uid > afterUid) fetched.push(msg);
      }
      const mails: IncomingMail[] = [];
      for (const msg of fetched) {
        const part = textPart(msg.bodyStructure);
        const text = part ? await readAll((await client.download(String(msg.uid), part, { uid: true, maxBytes: MAX_TEXT_BYTES })).content) : '';
        const sender = msg.envelope?.from?.[0];
        mails.push({
          from: (sender?.address ?? '').toLowerCase(),
          fromName: sender?.name ?? '',
          subject: msg.envelope?.subject ?? '',
          date: (msg.envelope?.date ?? new Date()).toISOString(),
          ...(msg.envelope?.inReplyTo ? { inReplyTo: msg.envelope.inReplyTo } : {}),
          references: references(msg.headers),
          text,
        });
      }
      return { mails, lastUid: Math.max(afterUid ?? 0, ...fetched.map((m) => m.uid)) };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}
