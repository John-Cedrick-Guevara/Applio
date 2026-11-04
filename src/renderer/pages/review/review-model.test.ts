import { describe, expect, it } from 'vitest';
import type { Job } from '../../../shared/types';
import { modeLabel, primaryAction, queueState, runLine } from './review-model';

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
      .toBe('Last run 08:00 · 62 found · 47 new after dedup · 9 passed filters · 4 drafted');
  });

  it('handles a fresh install', () => {
    expect(runLine(undefined)).toBe('No runs yet. Run discovery to fill the queue.');
  });
});
