import { describe, expect, it } from 'vitest';
import type { Job } from '../../../shared/types';
import { effortLevel, modeLabel, pendingReason, primaryAction, queueState, runLine, runResult } from './review-model';

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
