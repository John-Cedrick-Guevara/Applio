import { describe, expect, it } from 'vitest';
import type { Job } from '../../../shared/types';
import type { SendRecord } from '../../../shared/types';
import { formatClock } from '../../lib/format';
import { jobSteps, inboxTabs, effortLevel, gmailIssue, traceLine, modeLabel, primaryAction, queueState, sendState } from './review-model';

const job = (over: Partial<Job>): Job => ({
  id: 'x', sourceId: 's', sourceName: 'S', company: 'C', title: 'T', url: '', location: '', employmentType: 'full-time',
  postedAt: '', status: 'drafted', channel: 'email', description: '', tags: [], strengths: [], gaps: [], applyTarget: '',
  factsUsed: 0, tokensUsed: 0, history: [], ...over,
});

describe('primaryAction', () => {
  it('sends email and submits ATS forms directly', () => {
    expect(primaryAction(job({ channel: 'email' }))).toEqual({ label: 'Approve & send email', handoff: false });
    expect(primaryAction(job({ channel: 'ats' }))).toEqual({ label: 'Approve & submit form', handoff: false });
  });

  it('opens the handoff for platform and career-site jobs', () => {
    expect(primaryAction(job({ channel: 'platform' }))).toEqual({ label: 'Open handoff', handoff: true });
    expect(primaryAction(job({ channel: 'custom' })).handoff).toBe(true);
  });
});

describe('queueState', () => {
  it('describes where each queued job stands', () => {
    expect(queueState(job({ channel: 'email' }))).toBe('Draft ready');
    expect(queueState(job({ channel: 'platform' }))).toBe('Ready to hand off');
    expect(queueState(job({ status: 'applied' }))).toBe('Sent');
    expect(queueState(job({ status: 'skipped' }))).toBe('Skipped');
  });

  it('never calls an approved job that did not go out Sent', () => {
    expect(queueState(job({ status: 'approved', channel: 'email' }))).toBe('Not sent');
    expect(queueState(job({ status: 'approved', channel: 'ats' }))).toBe('Not sent');
    expect(queueState(job({ status: 'approved', channel: 'platform' }))).toBe('Ready to hand off');
  });
});

describe('modeLabel', () => {
  it('caps autonomy by channel', () => {
    expect(modeLabel(job({ channel: 'email' }), 'autonomous')).toBe('Autonomous');
    expect(modeLabel(job({ channel: 'email' }), 'draft')).toBe('Draft → Approve');
  });

  it('never runs platform jobs on their own', () => {
    expect(modeLabel(job({ channel: 'platform' }), 'autonomous')).toBe('Manual handoff');
  });
});

describe('effortLevel', () => {
  it('maps the match score to how much effort the application deserves', () => {
    expect(effortLevel(49)).toBe('Quick');
    expect(effortLevel(50)).toBe('Medium');
    expect(effortLevel(74)).toBe('Medium');
    expect(effortLevel(75)).toBe('High');
  });
});

describe('sendState', () => {
  const at = '2026-11-07T09:30:00.000Z';
  const sent: SendRecord = { state: 'sent', channel: 'email', to: 'jobs@acme.com', subject: 'Application: T — Sam', body: 'Hi', attachments: ['Rivera_T.pdf'], at };

  it('is waiting while the draft is waiting on the operator', () => {
    expect(sendState(job({ status: 'drafted' }), null)).toEqual({ kind: 'waiting' });
  });

  it('says Sent only when a sent record exists, naming the recipient and folder', () => {
    expect(sendState(job({ status: 'applied', folderPath: '/Users/sam/Applio/2026-11/Acme — T (88%)' }), sent)).toEqual({
      kind: 'sent', line: `Sent to jobs@acme.com at ${formatClock(at)}.`, folder: 'Acme — T (88%)',
    });
  });

  it('names a submitted form by its URL', () => {
    expect(sendState(job({ status: 'applied', channel: 'ats' }), { ...sent, channel: 'ats', to: 'https://jobs.lever.co/acme/1/apply' })).toMatchObject({ kind: 'sent', line: `Form submitted at ${formatClock(at)}.` });
  });

  it('is not sent, with the reason, when the job was approved but nothing went out', () => {
    const failed = job({ status: 'approved', history: [{ status: 'approved', at }, { status: 'approved', at, note: 'Not sent: Gmail rejected the app password.' }] });
    expect(sendState(failed, null)).toEqual({ kind: 'not-sent', reason: 'Gmail rejected the app password.' });
  });

  it('passes on why a form was handed back, so the operator knows to finish it', () => {
    const handed = job({ status: 'approved', channel: 'ats', history: [{ status: 'drafted', at, note: 'Old note' }, { status: 'approved', at }, { status: 'approved', at, note: 'Handed to you: the form has a CAPTCHA.' }] });
    expect(sendState(handed, null)).toEqual({ kind: 'not-sent', reason: 'Handed to you: the form has a CAPTCHA.' });
  });

  it('ignores notes from before the approval', () => {
    expect(sendState(job({ status: 'approved', history: [{ status: 'drafted', at, note: 'The résumé prints on 2 pages.' }, { status: 'approved', at }] }), null)).toEqual({ kind: 'not-sent', reason: "It hasn't gone out yet." });
  });

  it('is not sent with a generic reason when no note says why', () => {
    expect(sendState(job({ status: 'approved' }), null)).toEqual({ kind: 'not-sent', reason: "It hasn't gone out yet." });
  });

  it("is unconfirmed when a send started and never reported back", () => {
    expect(sendState(job({ status: 'approved' }), { state: 'sending', channel: 'email', at })).toEqual({ kind: 'unconfirmed', at });
  });

  it('is waiting for the handoff when a platform job was approved', () => {
    expect(sendState(job({ status: 'approved', channel: 'platform' }), null)).toEqual({ kind: 'handoff' });
  });

  it('is applied by the operator when there is no send record', () => {
    expect(sendState(job({ status: 'applied', sentBy: 'you-manual' }), null)).toEqual({ kind: 'applied-manually' });
  });

  it('is skipped for a skipped job', () => {
    expect(sendState(job({ status: 'skipped' }), null)).toEqual({ kind: 'skipped' });
  });
});

describe('gmailIssue', () => {
  const set = { anthropicApiKey: false, gmailAppPassword: true, telegramBotToken: false };
  const at = '2026-11-08T09:00:00.000Z';
  it('asks for setup while the address or app password is missing', () => {
    expect(gmailIssue({ gmailAddress: '', secretsSet: set, checks: {} })?.action).toBe('Set up Gmail to send');
  });
  it('asks for a fix when the saved password was rejected', () => {
    expect(gmailIssue({ gmailAddress: 'a@b.co', secretsSet: set, checks: { gmail: { ok: false, at, message: 'Rejected.' } } })).toMatchObject({ action: 'Fix Gmail to send', message: expect.stringContaining('Rejected.') });
  });
  it('lets the operator send when Gmail signed in, was never checked, or was only unreachable', () => {
    expect(gmailIssue({ gmailAddress: 'a@b.co', secretsSet: set, checks: { gmail: { ok: true, at, message: '' } } })).toBeUndefined();
    expect(gmailIssue({ gmailAddress: 'a@b.co', secretsSet: set, checks: {} })).toBeUndefined();
    expect(gmailIssue({ gmailAddress: 'a@b.co', secretsSet: set, checks: { gmail: { ok: false, offline: true, at, message: '' } } })).toBeUndefined();
  });
});

describe('traceLine', () => {
  const clean = { stale: false, unverified: [], forbidden: [], placeholders: [] };
  it('puts a leftover placeholder first, since the draft cannot be sent with it', () => {
    expect(traceLine({ edited: false, check: { ...clean, placeholders: ['[Your Name]'] } }, 12)).toEqual({ text: 'Replace [Your Name] before sending', ok: false });
  });
  it('claims every claim traced only when the check found nothing', () => {
    expect(traceLine({ edited: false, check: clean }, 12)).toEqual({ text: 'Every claim traced to your fact bank · 12 facts used', ok: true });
  });
  it('counts the cover-letter lines nothing backs', () => {
    expect(traceLine({ edited: false, check: { ...clean, unverified: [{ line: 'a', terms: ['X'] }, { line: 'b', terms: ['Y'] }] } }, 12)).toEqual({ text: 'Résumé traced to facts · cover letter: 2 unverified lines', ok: false });
  });
  it('names a term the notes forbid', () => {
    expect(traceLine({ edited: false, check: { ...clean, forbidden: ['intern'] } }, 12)).toEqual({ text: 'Uses "intern", which your notes for Claude forbid', ok: false });
  });
  it('says an edited letter is the operator\'s own, not checked against facts', () => {
    expect(traceLine({ edited: true, check: clean }, 12)).toEqual({ text: 'Résumé traced to facts · letter edited by you, not checked', ok: false });
  });
  it('never claims a trace it has no check for', () => {
    expect(traceLine({ edited: false }, 12)).toEqual({ text: 'Résumé traced to facts · cover letter not checked', ok: false });
  });
});

describe('inboxTabs', () => {
  const email = job({ id: 'e', channel: 'email', score: 80 });
  const site = job({ id: 'c', channel: 'custom', score: 90 });
  const unsent = job({ id: 'u', status: 'approved', channel: 'email', score: 70 });
  const handedOff = job({ id: 'h', status: 'approved', channel: 'platform', score: 60 });
  const flagged = job({ id: 'f', channel: 'email', score: 95, suspicious: 'The post addresses AI tools directly.' });
  const asking = job({ id: 'q', status: 'scored', score: 60 });
  const tabs = inboxTabs([email, site, unsent, handedOff, flagged], [asking], 'score');
  const ids = (key: string) => tabs.find((t) => t.key === key)!.jobs.map((j) => j.id);

  it('files each waiting job under exactly one tab, most urgent tab first', () => {
    expect(tabs.map((t) => t.key)).toEqual(['fix', 'answer', 'approve', 'handoff']);
    expect([...ids('fix'), ...ids('answer'), ...ids('approve'), ...ids('handoff')].sort()).toEqual(['c', 'e', 'f', 'h', 'q', 'u']);
    expect(ids('answer')).toEqual(['q']);
    expect(ids('approve')).toEqual(['e']);
    expect(ids('handoff')).toEqual(['c', 'h']);
  });

  it('puts a suspicious post and an approved job that did not send under Fix first', () => {
    expect(ids('fix')).toEqual(['f', 'u']);
  });

  it('leaves out a job decided on this visit, skipped or sent', () => {
    const decided = inboxTabs([job({ id: 's', status: 'skipped' }), job({ id: 'a', status: 'applied' })], [], 'score');
    expect(decided.flatMap((t) => t.jobs)).toEqual([]);
  });

  it('keeps every tab, even an empty one, so counts never jump around', () => {
    expect(inboxTabs([], [], 'score').map((t) => t.jobs.length)).toEqual([0, 0, 0, 0]);
  });

  it('sorts a tab by best match or oldest', () => {
    const old = job({ id: 'o', score: 50, history: [{ status: 'found', at: '2026-11-01T00:00:00.000Z' }] });
    const fresh = job({ id: 'n', score: 90, history: [{ status: 'found', at: '2026-11-12T00:00:00.000Z' }] });
    const approve = (sort: 'score' | 'oldest') => inboxTabs([old, fresh], [], sort).find((t) => t.key === 'approve')!.jobs.map((j) => j.id);
    expect(approve('score')).toEqual(['n', 'o']);
    expect(approve('oldest')).toEqual(['o', 'n']);
  });
});

describe('jobSteps', () => {
  const states = (...args: Parameters<typeof jobSteps>) => Object.fromEntries(jobSteps(...args).map((s) => [s.label, s.state]));
  const sent: SendRecord = { state: 'sent', channel: 'email', to: 'a@b.c', subject: 's', body: 'b', attachments: [], at: '2026-11-08T09:14:00.000Z' };

  it('uses the five lifecycle words and waits on the operator at Drafted until a draft starts', () => {
    expect(states(job({ status: 'scored' }))).toEqual({ New: 'done', Matched: 'done', Drafted: 'blocked', Ready: 'todo', Sent: 'todo' });
  });

  it('shows Drafted in progress while Claude drafts', () => {
    expect(states(job({ status: 'scored' }), { drafting: true }).Drafted).toBe('current');
  });

  it('keeps Drafted in progress while the PDFs save, then failed with the saved note', () => {
    expect(states(job({ status: 'drafted' }))).toMatchObject({ Drafted: 'current', Ready: 'todo' });
    const failed = job({ status: 'drafted', history: [{ status: 'drafted', at: '', note: "Couldn't save the files: printing took longer than 60 s" }] });
    expect(states(failed).Drafted).toBe('failed');
  });

  it('waits on the operator at Ready once the PDFs are saved', () => {
    expect(states(job({ status: 'drafted', folderPath: '/x' }))).toMatchObject({ Drafted: 'done', Ready: 'blocked', Sent: 'todo' });
  });

  it('calls a job sent only when a sent record exists', () => {
    expect(states(job({ status: 'approved', folderPath: '/x' }), { send: null }).Sent).toBe('failed');
    expect(states(job({ status: 'applied', folderPath: '/x' }), { send: sent }).Sent).toBe('done');
  });
});
