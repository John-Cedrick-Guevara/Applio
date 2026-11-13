import { describe, expect, it } from 'vitest';
import type { Draft, Job, SendRecord } from '../../../shared/types';
import { draftCard, nextLine, undraftedCard } from './job-card';

const job = (over: Partial<Job>): Job => ({
  id: 'x', sourceId: 's', sourceName: 'S', company: 'Acme', title: 'Engineer', url: '', location: '', employmentType: 'full-time',
  postedAt: '', status: 'drafted', channel: 'email', description: '', tags: [], strengths: [], gaps: [], applyTarget: 'jobs@acme.example',
  factsUsed: 0, tokensUsed: 0, history: [], folderPath: '/out/acme', ...over,
});
const draft = (check: Partial<NonNullable<Draft['check']>> = {}): Draft => ({
  jobId: 'x', kind: 'cover-letter', headline: '', summary: '', resume: [], coverLetter: '', edited: false, answers: [], createdAt: '',
  check: { stale: false, unverified: [], forbidden: [], placeholders: [], ...check },
});
const sent: SendRecord = { state: 'sent', channel: 'email', to: 'jobs@acme.example', subject: 's', body: 'b', attachments: [], at: '2026-11-08T09:14:00.000Z' };
const failedSave = { status: 'drafted' as const, at: '', note: "Couldn't save the files: printing took longer than 60 s" };
const kind = (input: Parameters<typeof draftCard>[0]) => draftCard(input).card.kind;

describe('draftCard', () => {
  it('shows ready when nothing else applies', () => {
    expect(draftCard({ job: job({}), draft: draft(), send: null }).card).toMatchObject({ kind: 'ready', tone: 'done' });
  });

  it('shows a hand-off channel as ready for you to apply', () => {
    expect(draftCard({ job: job({ channel: 'custom' }), draft: draft(), send: null }).card).toMatchObject({ kind: 'ready', title: 'Ready for you to apply.' });
  });

  it('shows the PDFs saving over ready', () => {
    expect(kind({ job: job({ folderPath: undefined }), draft: draft(), send: null })).toBe('saving');
  });

  it('picks an older profile over the PDFs saving', () => {
    expect(kind({ job: job({ folderPath: undefined }), draft: draft({ stale: true }), send: null })).toBe('stale');
  });

  it('picks Gmail not ready over the PDFs saving, for email only', () => {
    const gmailIssue = { message: "Gmail isn't set up, so approving can't send this email." };
    expect(kind({ job: job({ folderPath: undefined }), draft: draft(), send: null, gmailIssue })).toBe('setup');
    expect(kind({ job: job({ channel: 'ats' }), draft: draft(), send: null, gmailIssue })).toBe('ready');
  });

  it('picks an older profile over Gmail not ready, so the draft is fixed first', () => {
    expect(kind({ job: job({}), draft: draft({ stale: true }), send: null, gmailIssue: { message: 'm' } })).toBe('stale');
  });

  it('picks placeholders left in the letter over an older profile', () => {
    expect(kind({ job: job({}), draft: draft({ stale: true, placeholders: ['[Your Name]'] }), send: null })).toBe('placeholders');
  });

  it('picks failed PDFs over placeholders, with the saved reason', () => {
    const card = draftCard({ job: job({ folderPath: undefined, history: [failedSave] }), draft: draft({ placeholders: ['[X]'] }), send: null }).card;
    expect(card).toMatchObject({ kind: 'files-failed', tone: 'failed' });
    expect(card.body).toContain('printing took longer than 60 s');
  });

  it('picks a suspicious post over failed PDFs', () => {
    expect(kind({ job: job({ suspicious: 'It addresses AI tools.', folderPath: undefined, history: [failedSave] }), draft: draft(), send: null })).toBe('suspicious');
  });

  it('picks a failed send over everything', () => {
    const card = draftCard({ job: job({ suspicious: 'x' }), draft: draft({ stale: true }), send: null, sendError: 'Gmail rejected the app password.' }).card;
    expect(card).toMatchObject({ kind: 'send-error', tone: 'failed', title: 'Not sent.' });
  });

  it('folds every other state that applies into notes', () => {
    const { card, notes } = draftCard({ job: job({ suspicious: 'x', folderPath: undefined }), draft: draft({ stale: true }), send: null });
    expect(card.kind).toBe('suspicious');
    expect(notes).toEqual(['Made from an older profile.', 'Saving the résumé and letter PDFs.']);
  });

  it('reads after-decision states from the send log', () => {
    expect(kind({ job: job({ status: 'approved' }), draft: draft(), send: null })).toBe('not-sent');
    expect(kind({ job: job({ status: 'approved' }), draft: draft(), send: { ...sent, state: 'sending' } })).toBe('unconfirmed');
    expect(kind({ job: job({ status: 'approved', channel: 'platform' }), draft: draft(), send: null })).toBe('handed-off');
    expect(kind({ job: job({ status: 'applied' }), draft: draft(), send: sent })).toBe('sent');
    expect(kind({ job: job({ status: 'applied' }), draft: draft(), send: null })).toBe('applied');
    expect(kind({ job: job({ status: 'skipped' }), draft: draft(), send: null })).toBe('skipped');
  });

  it('never says sent without a sent record', () => {
    const { card } = draftCard({ job: job({ status: 'approved' }), draft: draft(), send: null });
    expect(card.title).not.toMatch(/sent at|^sent/i);
    expect(card.tone).toBe('failed');
  });

  it('keeps notes off once the operator has decided', () => {
    expect(draftCard({ job: job({ status: 'applied', suspicious: 'x' }), draft: draft({ stale: true }), send: sent }).notes).toEqual([]);
  });
});

describe('nextLine', () => {
  it('says a hand-off channel is never sent by Applio', () => {
    expect(nextLine(job({ channel: 'custom' }), null)).toMatch(/^Never sent by Applio/);
  });

  it('says a suspicious post never sends on its own', () => {
    expect(nextLine(job({ suspicious: 'x' }), null)).toMatch(/Never sends on its own because the post looks suspicious/);
  });

  it('gives the saved reason a held draft did not send on its own', () => {
    const held = job({ history: [{ status: 'drafted', at: '', note: 'Not sent automatically: Its match score (70) is below the auto-send score (85).' }] });
    expect(nextLine(held, null)).toBe("Waits for your approval. It didn't send on its own: its match score (70) is below the auto-send score (85).");
  });

  it('says where approving sends when nothing was held', () => {
    expect(nextLine(job({}), null)).toBe('Waits for your approval. Approving sends it to jobs@acme.example.');
    expect(nextLine(job({ channel: 'ats', applyTarget: 'boards.greenhouse.io' }), null)).toBe('Waits for your approval. Approving submits the form at boards.greenhouse.io.');
  });

  it('says what follows a send, a failed send and a skip', () => {
    expect(nextLine(job({ status: 'applied' }), sent)).toMatch(/watches your inbox for a reply/);
    expect(nextLine(job({ status: 'approved' }), null)).toBe('It stays in Review until it sends or you skip it.');
    expect(nextLine(job({ status: 'skipped' }), null)).toMatch(/stays out of your queue/);
  });
});

describe('undraftedCard', () => {
  const scored = (score: number, over: Partial<Job> = {}) => job({ status: 'scored', score, folderPath: undefined, ...over });

  it('calls a match at or above the draft bar strong, not drafted yet', () => {
    expect(undraftedCard(scored(67), { draftBar: 60 })).toMatchObject({ kind: 'to-draft', title: 'Strong match, not drafted yet.' });
  });

  it('says a match is below the draft bar, with both numbers', () => {
    const card = undraftedCard(scored(40), { draftBar: 75 });
    expect(card.kind).toBe('below');
    expect(card.body).toContain('below your draft bar (75)');
  });

  it('gives a failed draft its saved reason', () => {
    const card = undraftedCard(scored(80, { history: [{ status: 'scored', at: '', note: 'Not drafted: Claude timed out.' }] }), { draftBar: 60 });
    expect(card).toMatchObject({ kind: 'draft-failed', tone: 'failed' });
    expect(card.body).toContain('Claude timed out');
  });

  it('puts the budget stop over everything for a scored job', () => {
    expect(undraftedCard(scored(80), { draftBar: 60, budgetStop: "Today's Claude token budget is used up." })).toMatchObject({ kind: 'budget', body: "Today's Claude token budget is used up." });
  });

  it('says an unscored job waits for a scan', () => {
    expect(undraftedCard(job({ status: 'found', folderPath: undefined }), { draftBar: 60 })).toMatchObject({ kind: 'unscored', title: 'Not scored yet.' });
  });
});
