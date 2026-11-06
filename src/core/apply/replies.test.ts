import { describe, expect, it } from 'vitest';
import { classifyReply, matchReply, replySummary, type Application, type IncomingMail } from './replies';

const apps: Application[] = [
  { id: 'j1', company: 'Acme, Inc.', applyTarget: 'jobs@acme.com', messageIds: ['<j1.a@applio.local>'], status: 'applied' },
  { id: 'j2', company: 'Globex', applyTarget: 'jobs.lever.co', messageIds: [], status: 'applied' },
  { id: 'j3', company: 'Initech', applyTarget: 'careers@gmail.com', messageIds: [], status: 'applied' },
];
const mail = (over: Partial<IncomingMail> = {}): IncomingMail => ({ from: 'someone@elsewhere.io', fromName: 'Someone', subject: 'Hello', date: '2026-11-21T10:00:00.000Z', references: [], text: 'Hi', ...over });

describe('matchReply', () => {
  it('matches a reply in the application thread first', () => {
    expect(matchReply(mail({ inReplyTo: '<j1.a@applio.local>' }), apps)).toBe('j1');
    expect(matchReply(mail({ references: ['<x@y>', '<j1.a@applio.local>'] }), apps)).toBe('j1');
  });

  it("matches the domain of the address the application went to", () => {
    expect(matchReply(mail({ from: 'maria@acme.com' }), apps)).toBe('j1');
  });

  it("matches the company's name in the sender's domain or name", () => {
    expect(matchReply(mail({ from: 'talent@globex.io' }), apps)).toBe('j2');
    expect(matchReply(mail({ from: 'no-reply@hire.lever.co', fromName: 'Globex Recruiting' }), apps)).toBe('j2');
  });

  it("never matches by a webmail domain like gmail.com", () => {
    expect(matchReply(mail({ from: 'friend@gmail.com' }), apps)).toBeUndefined();
  });

  it('ignores mail that matches nothing', () => {
    expect(matchReply(mail(), apps)).toBeUndefined();
  });

  it('ignores applications that already closed', () => {
    expect(matchReply(mail({ from: 'maria@acme.com' }), [{ ...apps[0]!, status: 'rejected' }])).toBeUndefined();
  });
});

describe('classifyReply', () => {
  it.each([
    ['Unfortunately, we have decided to move forward with other candidates.', 'rejected'],
    ["We regret to inform you the position has been filled.", 'rejected'],
    ["We'd love to schedule an interview. What's your availability next week?", 'interview'],
    ['Thanks for applying! We received your application.', 'replied'],
  ] as const)('reads %j as %s', (text, status) => {
    expect(classifyReply(mail({ text }))).toBe(status);
  });

  it('reads a rejection even when it mentions an interview', () => {
    expect(classifyReply(mail({ text: 'Thank you for interviewing with us. Unfortunately we will not be moving forward.' }))).toBe('rejected');
  });
});

describe('replySummary', () => {
  it('keeps the first new lines, dropping quoted history and signatures, at most 200 characters', () => {
    const text = 'Hi Sam,\n\nThanks for applying. Are you free Tuesday?\n\nOn Mon, Nov 10, 2026 at 9:00 AM Sam wrote:\n> Dear team\n> I build APIs';
    expect(replySummary(mail({ text }))).toBe('Hi Sam, Thanks for applying. Are you free Tuesday?');
    expect(replySummary(mail({ text: 'x'.repeat(500) }))).toHaveLength(200);
  });

  it('falls back to the subject when there is no text', () => {
    expect(replySummary(mail({ text: '', subject: 'Your application' }))).toBe('Your application');
  });
});
