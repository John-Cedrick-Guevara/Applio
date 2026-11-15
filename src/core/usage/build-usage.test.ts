import { describe, expect, it } from 'vitest';
import { buildUsage, type UsageInput } from './build-usage';

const NOW = new Date(2026, 10, 20, 15, 0); // 20 Nov 2026, local
const at = (day: number, hour = 10) => new Date(2026, 10, day, hour).toISOString();

const input = (over: Partial<UsageInput> = {}): UsageInput => ({
  now: NOW,
  usage: [
    { at: at(20), step: 'score', tokens: 1000 },
    { at: at(20, 11), step: 'tailor', tokens: 4000 },
    { at: at(19), step: 'tailor', tokens: 3000 },
    { at: at(2), step: 'prep', tokens: 500 },
    { at: new Date(2026, 9, 30).toISOString(), step: 'score', tokens: 9999 }, // last month
  ],
  sent: [
    { at: at(20), sentBy: 'autonomous', channel: 'email', tokens: 6000 },
    { at: at(20, 12), sentBy: 'you-telegram', channel: 'ats', tokens: 4000 },
    { at: at(18), sentBy: 'you-manual', channel: 'platform', tokens: 2000 },
  ],
  bankAnswersReused: [{ at: at(20) , count: 2 }, { at: at(10), count: 3 }],
  polls: [{ id: 'remotive', name: 'Remotive', used: 4, limit: 4 }, { id: 'hn', name: 'HN Who is hiring', used: 0, limit: 1 }],
  settings: { dailyTokenBudget: 10_000, monthlyTokenBudget: 100_000, maxPerChannelPerDay: 10 },
  gmailDailyCap: 100,
  runs: [
    { at: at(20), found: 80, duplicates: 10, passed: 6, dropped: { seniority: 40, location: 20, role: 4 } },
    { at: at(20, 14), found: 20, duplicates: 15, passed: 1, dropped: { seniority: 3, location: 1 } },
    { at: at(3), found: 50, duplicates: 0, passed: 50, dropped: {} },
  ],
  ...over,
});

describe('buildUsage', () => {
  it("totals today's tokens, sends and their split", () => {
    const { summary } = buildUsage('today', input());
    expect(summary).toMatchObject({ tokens: 5000, tokenBudget: 10_000, sent: 2, sentLimit: 20, sentBreakdown: { autonomous: 1, approved: 1, manual: 0 }, avgTokensPerApplication: 5000 });
  });

  it("totals this month's, with no daily send limit", () => {
    const { summary } = buildUsage('month', input());
    expect(summary).toMatchObject({ tokens: 8500, tokenBudget: 100_000, sent: 3, sentBreakdown: { autonomous: 1, approved: 1, manual: 1 }, avgTokensPerApplication: 4000 });
    expect(summary.sentLimit).toBeUndefined();
  });

  it('splits tokens by step, every step listed', () => {
    expect(buildUsage('today', input()).tokensByStep).toEqual([
      { step: 'tailor', tokens: 4000 }, { step: 'score', tokens: 1000 }, { step: 'answers', tokens: 0 }, { step: 'prep', tokens: 0 }, { step: 'follow-up', tokens: 0 }, { step: 'facts', tokens: 0 },
    ]);
  });

  it('charts the last 7 local days, oldest first', () => {
    const days = buildUsage('today', input()).tokensByDay;
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toEqual({ date: '2026-11-20', tokens: 5000 });
    expect(days.at(-2)).toEqual({ date: '2026-11-19', tokens: 3000 });
    expect(days[0]?.date).toBe('2026-11-14');
  });

  it('estimates what reusing bank answers saved', () => {
    expect(buildUsage('today', input()).summary.savedByAnswerBank).toEqual({ tokens: 400, answersReused: 2 });
    expect(buildUsage('month', input()).summary.savedByAnswerBank).toEqual({ tokens: 1000, answersReused: 5 });
  });

  it('lists every SPEC F10 limit with its real state', () => {
    const quotas = buildUsage('today', input({ sent: [...input().sent, { at: at(20, 13), sentBy: 'autonomous', channel: 'email', tokens: 0 }] })).quotas;
    expect(quotas.map((q) => q.id)).toEqual(['tokens-day', 'tokens-month', 'gmail', 'remotive', 'hn', 'upwork', 'jsearch']);
    expect(quotas.find((q) => q.id === 'tokens-day')).toMatchObject({ used: 5000, limit: 10_000, warnAt: 0.8 });
    expect(quotas.find((q) => q.id === 'tokens-month')).toMatchObject({ used: 8500, limit: 100_000 });
    expect(quotas.find((q) => q.id === 'gmail')).toMatchObject({ used: 2, limit: 100 });
    expect(quotas.find((q) => q.id === 'remotive')).toMatchObject({ used: 4, limit: 4, doneLabel: 'Done for today' });
    expect(quotas.find((q) => q.id === 'upwork')).toMatchObject({ off: true });
    expect(quotas.find((q) => q.id === 'jsearch')).toMatchObject({ off: true });
  });

  it("sums the period's prefilter, per drop reason, biggest first, so the operator sees what each filter removes", () => {
    expect(buildUsage('today', input()).prefilter).toEqual({
      found: 100, duplicates: 25, passed: 7,
      dropped: [{ reason: 'seniority', count: 43 }, { reason: 'location', count: 21 }, { reason: 'role', count: 4 }],
    });
  });
});
