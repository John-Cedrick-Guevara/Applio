// @vitest-environment node
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { readInbox, type InboxClient } from './inbox';

/** A fake IMAP client over two messages, recording what was asked. */
const fake = (afterLast: number[] = [41, 42]) => {
  const messages = [
    { uid: 41, envelope: { from: [{ name: 'Maria', address: 'maria@acme.com' }], subject: 'Re: Application', date: new Date('2026-11-21T10:00:00Z'), inReplyTo: '<j1.a@applio.local>' },
      headers: Buffer.from('References: <x@y> <j1.a@applio.local>\r\n'), bodyStructure: { type: 'multipart/alternative', childNodes: [{ part: '1', type: 'text/plain' }, { part: '2', type: 'text/html' }] } },
    { uid: 42, envelope: { from: [{ address: 'news@shop.com' }], subject: 'Sale', date: new Date('2026-11-21T11:00:00Z') }, headers: Buffer.from(''), bodyStructure: { type: 'text/html', part: '1' } },
  ].filter((m) => afterLast.includes(m.uid));
  const client: InboxClient & { calls: string[] } = {
    calls: [],
    connect: vi.fn(async () => {}),
    getMailboxLock: vi.fn(async (path: string, opts?: { readOnly?: boolean }) => (client.calls.push(`lock ${path} ${opts?.readOnly}`), { release: () => {} })),
    fetch: (range: unknown) => {
      client.calls.push(`fetch ${JSON.stringify(range)}`);
      return (async function* () { yield* messages; })() as never;
    },
    download: vi.fn(async (uid: string, part?: string) => ({ content: Readable.from([Buffer.from(`body of ${uid} part ${part}`)]) })) as never,
    logout: vi.fn(async () => {}),
  };
  return client;
};

describe('readInbox', () => {
  it('reads new mail read-only, with its thread headers and plain text', async () => {
    const client = fake();
    const { mails, lastUid } = await readInbox({ afterUid: 40, since: new Date('2026-11-01') }, () => client);
    expect(client.calls).toEqual(['lock INBOX true', 'fetch {"uid":"41:*"}']);
    expect(lastUid).toBe(42);
    expect(mails[0]).toEqual({
      from: 'maria@acme.com', fromName: 'Maria', subject: 'Re: Application', date: '2026-11-21T10:00:00.000Z',
      inReplyTo: '<j1.a@applio.local>', references: ['<x@y>', '<j1.a@applio.local>'], text: 'body of 41 part 1',
    });
    expect(mails[1]).toMatchObject({ from: 'news@shop.com', text: '' });
    expect(client.logout).toHaveBeenCalled();
  });

  it('looks back from a date the first time', async () => {
    const client = fake();
    await readInbox({ since: new Date('2026-11-01T00:00:00Z') }, () => client);
    expect(client.calls[1]).toBe('fetch {"since":"2026-11-01T00:00:00.000Z"}');
  });

  it("skips the newest message IMAP returns when nothing is newer than the last one read", async () => {
    const client = fake([42]);
    const { mails, lastUid } = await readInbox({ afterUid: 42, since: new Date() }, () => client);
    expect(mails).toEqual([]);
    expect(lastUid).toBe(42);
  });

  it('logs out even when reading fails', async () => {
    const client = fake();
    client.fetch = () => { throw new Error('connection lost'); };
    await expect(readInbox({ since: new Date() }, () => client)).rejects.toThrow('connection lost');
    expect(client.logout).toHaveBeenCalled();
  });
});
