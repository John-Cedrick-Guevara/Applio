import { describe, expect, it } from 'vitest';
import type { AppStatus } from '../../shared/types';
import { formatClock } from '../lib/format';
import { activityModel } from './activity-model';

const status = (over: Partial<AppStatus> = {}): AppStatus => ({
  engine: 'claude-code', engineReady: true, paused: false, tokensToday: 20_000, dailyTokenBudget: 150_000, ...over,
});
const NOW = Date.parse('2026-11-13T10:00:00.000Z');
const ctx = { autoSendThreshold: 85, autonomousSources: 1, now: NOW };

describe('activityModel: running work', () => {
  it('names the scan phase with elapsed time', () => {
    const m = activityModel(status({ scan: { phase: 'scoring', startedAt: '2026-11-13T09:58:48.000Z' }, drafting: ['a'] }), ctx);
    expect(m.running).toEqual({ kind: 'scan', text: 'Scanning · scoring matches · 1:12' });
  });

  it('shows drafts when no scan runs', () => {
    expect(activityModel(status({ drafting: ['a', 'b'] }), ctx).running).toEqual({ kind: 'drafting', text: 'Drafting 2 · you can keep working' });
  });

  it('shows the last scan when idle', () => {
    const at = '2026-11-13T08:00:00.000Z';
    const m = activityModel(status({ lastRun: { at, found: 1, newAfterDedup: 1, passedFilters: 1, drafted: 0 } }), ctx);
    expect(m.running).toEqual({ kind: 'idle', text: `Nothing running · last scan ${formatClock(at)}` });
  });

  it('says no scans yet', () => {
    expect(activityModel(status(), ctx).running.text).toBe('Nothing running · no scans yet');
  });
});

describe('activityModel: auto-send', () => {
  it('says auto-send is paused', () => {
    expect(activityModel(status({ paused: true }), ctx).auto).toEqual({ kind: 'paused', text: 'Auto-send paused · nothing goes out without your click' });
  });

  it('says auto-send is off when no source is autonomous', () => {
    expect(activityModel(status(), { ...ctx, autonomousSources: 0 }).auto).toEqual({ kind: 'off', text: 'Auto-send off · every source waits for your approval' });
  });

  it('says auto-send is on with the score', () => {
    expect(activityModel(status(), ctx).auto).toEqual({ kind: 'on', text: 'Auto-send on · email and ATS forms at 85+' });
  });
});

describe('activityModel: budget and engine', () => {
  it('keeps the budget blue under 80%', () => {
    expect(activityModel(status(), ctx).budget).toEqual({ pct: 13, tone: 'ok', text: '20k / 150k' });
  });

  it('turns the budget amber from 80%', () => {
    expect(activityModel(status({ tokensToday: 120_000 }), ctx).budget.tone).toBe('warn');
  });

  it('turns the budget red at the hard stop', () => {
    const m = activityModel(status({ tokensToday: 151_000, budgetStop: "Today's Claude token budget is used up." }), ctx);
    expect(m.budget).toMatchObject({ pct: 100, tone: 'stop' });
    expect(m.running.text).toBe('AI paused · budget used');
  });

  it('says the engine needs setup', () => {
    expect(activityModel(status({ engineReady: false }), ctx).engine).toBe('Claude needs setup');
    expect(activityModel(status(), ctx).engine).toBeUndefined();
  });
});
