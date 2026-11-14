import { describe, expect, it } from 'vitest';
import { parseGuardrails, toGuardrailsDraft } from './guardrails-model';

const draft = { draft: '75', auto: '85', perDay: '10', tokens: '150,000', monthTokens: '3,000,000', weeklyGoal: '15' };

describe('parseGuardrails', () => {
  it('accepts valid limits, including thousands separators', () => {
    expect(parseGuardrails(draft)).toEqual({ ok: true, value: { draftThreshold: 75, autoSendThreshold: 85, maxPerChannelPerDay: 10, dailyTokenBudget: 150_000, monthlyTokenBudget: 3_000_000 } });
  });

  it('keeps scores within 0–100', () => {
    const r = parseGuardrails({ ...draft, draft: '120' });
    expect(!r.ok && r.errors.draft).toMatch(/0 and 100/);
  });

  it('never auto-sends below the draft bar', () => {
    const r = parseGuardrails({ ...draft, auto: '60' });
    expect(!r.ok && r.errors.auto).toMatch(/at least the draft bar/);
  });

  it('requires a positive token budget', () => {
    expect(parseGuardrails({ ...draft, tokens: '0' }).ok).toBe(false);
    expect(parseGuardrails({ ...draft, tokens: 'lots' }).ok).toBe(false);
  });

  it('never lets the monthly budget sit below the daily one', () => {
    const r = parseGuardrails({ ...draft, monthTokens: '100,000' });
    expect(!r.ok && r.errors.monthTokens).toBe('The monthly budget must be at least the daily one.');
  });

  it('formats stored settings for the form', () => {
    expect(toGuardrailsDraft({ draftThreshold: 75, autoSendThreshold: 85, maxPerChannelPerDay: 10, weeklyGoal: 15, dailyTokenBudget: 150_000, monthlyTokenBudget: 3_000_000 })).toEqual(draft);
  });
});

describe('weekly goal', () => {
  it('validates the weekly goal', () => {
    for (const weeklyGoal of ['0', '101', 'x', '']) {
      const r = parseGuardrails({ ...draft, weeklyGoal });
      expect(!r.ok && r.errors.weeklyGoal).toBe('Enter a whole number from 1 to 100.');
    }
    const ok = parseGuardrails({ ...draft, weeklyGoal: '20' });
    expect(ok.ok && ok.value.weeklyGoal).toBe(20);
  });
});
