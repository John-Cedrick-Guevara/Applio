import { describe, expect, it } from 'vitest';
import type { Job } from '../../../shared/types';
import type { SendRecord } from '../../../shared/types';
import { formatClock } from '../../lib/format';
import { effortLevel, modeLabel, pendingReason, primaryAction, queueState, runLine, runResult, sendState } from './review-model';

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

describe('runLine', () => {
  it('summarizes the last run', () => {
    const at = new Date(2026, 10, 3, 8, 0).toISOString();
    expect(runLine({ at, found: 62, newAfterDedup: 47, passedFilters: 9, drafted: 4 }))
      .toBe('Last run 08:00 · 62 found · 47 not yet in Applio · 9 passed filters · 4 drafted');
  });

  it('says when every source was at its daily poll limit, instead of 0 found', () => {
    const at = new Date(2026, 10, 3, 8, 0).toISOString();
    expect(runLine({ at, found: 0, newAfterDedup: 0, passedFilters: 0, drafted: 0, atLimit: 8 }))
      .toBe("Last run 08:00 · every source has used today's polls; they poll again tomorrow");
  });

  it('notes sources at their limit alongside what the others found', () => {
    const at = new Date(2026, 10, 3, 8, 0).toISOString();
    expect(runLine({ at, found: 5, newAfterDedup: 5, passedFilters: 1, drafted: 0, atLimit: 1 }))
      .toBe("Last run 08:00 · 5 found · 5 not yet in Applio · 1 passed filters · 0 drafted · 1 source at today's limit");
  });

  it('handles a fresh install', () => {
    expect(runLine(undefined)).toBe('No runs yet. Run discovery to fill the queue.');
  });
});

describe('pendingReason', () => {
  const job = (status: 'found' | 'scored', note?: string) => ({ status, history: [{ status, at: '2026-11-06T00:00:00.000Z', ...(note ? { note } : {}) }] });

  it('shows the last failure note when there is one', () => {
    expect(pendingReason(job('scored', "Not drafted: Claude Code couldn't finish: API Error: 429"))).toBe("Not drafted: Claude Code couldn't finish: API Error: 429");
  });

  it('falls back to what is still to do', () => {
    expect(pendingReason(job('found'))).toBe('Not scored yet');
    expect(pendingReason(job('scored'))).toBe('Not drafted yet');
  });
});

describe('runResult', () => {
  const at = '2026-11-07T08:00:00.000Z';
  it('says what a run produced', () => {
    expect(runResult({ at, found: 62, newAfterDedup: 47, passedFilters: 9, drafted: 4 })).toBe('Run finished: 9 jobs passed your filters, 4 drafted.');
  });
  it('counts the jobs waiting on the operator\'s answers', () => {
    expect(runResult({ at, found: 62, newAfterDedup: 47, passedFilters: 9, drafted: 3, asked: 1 })).toBe('Run finished: 9 jobs passed your filters, 3 drafted. 1 needs your answers in Review.');
  });

  it('says plainly when nothing passed', () => {
    expect(runResult({ at, found: 62, newAfterDedup: 47, passedFilters: 0, drafted: 0 })).toBe('Run finished: nothing new passed your filters.');
  });
  it('says when the sources had no polls left', () => {
    expect(runResult({ at, found: 0, newAfterDedup: 0, passedFilters: 0, drafted: 0, atLimit: 8 })).toBe("Nothing was fetched: every source has used today's polls. They poll again tomorrow.");
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
