import { describe, expect, it } from 'vitest';
import type { AppStatus, Job, JobStatus } from '../../../shared/types';
import { budgetCard, needs, pipeline, sentSeries, upNext, weekCard } from './dashboard-model';

// Friday 13 Nov 2026, 15:00 local. Built from parts so the tests hold in any time zone.
const now = new Date(2026, 10, 13, 15, 0);
const at = (month: number, day: number, hour = 10) => new Date(2026, month - 1, day, hour).toISOString();

const job = (over: Partial<Job> & { events?: [JobStatus, string][] }): Job => {
  const { events, ...rest } = over;
  return {
    id: 'x', sourceId: 's', sourceName: 'RemoteOK', company: 'C', title: 'T', url: '', location: '', employmentType: 'full-time',
    postedAt: '', status: 'applied', channel: 'email', description: '', tags: [], strengths: [], gaps: [], applyTarget: '',
    factsUsed: 0, tokensUsed: 0, history: (events ?? [['applied', at(11, 12)]]).map(([status, when]) => ({ status, at: when })), ...rest,
  };
};

const status = (over: Partial<AppStatus> = {}): AppStatus => ({ engine: 'claude-code', engineReady: true, paused: false, tokensToday: 0, dailyTokenBudget: 150_000, ...over });

describe('needs', () => {
  it('counts needs like the inbox tabs', () => {
    const queue = [
      job({ id: 'a', status: 'drafted', channel: 'email', suspicious: 'odd' }),
      job({ id: 'b', status: 'approved', channel: 'email' }),
      job({ id: 'c', status: 'drafted', channel: 'email' }),
      job({ id: 'd', status: 'drafted', channel: 'platform' }),
      job({ id: 'e', status: 'skipped', channel: 'email' }),
    ];
    const n = needs(queue, 3);
    expect(n.rows.map((r) => [r.key, r.count])).toEqual([['fix', 2], ['answer', 3], ['approve', 1], ['handoff', 1]]);
    expect(n.total).toBe(7);
  });
});

describe('weekCard', () => {
  it('counts this week from Monday, split by who sent', () => {
    const jobs = [
      job({ id: '1', sentBy: 'autonomous', events: [['applied', at(11, 9, 8)]] }), // Monday morning
      job({ id: '2', sentBy: 'you-app', events: [['applied', at(11, 12)]] }),
      job({ id: '3', sentBy: 'you-manual', events: [['applied', at(11, 13, 9)]] }),
      job({ id: '4', sentBy: 'autonomous', events: [['applied', at(11, 8, 23)]] }), // Sunday: last week
    ];
    expect(weekCard(jobs, 15, now)).toMatchObject({ sent: 3, byApplio: 2, byYou: 1, goal: 15, pct: 20 });
  });

  it('ignores skipped and unsent jobs, and counts a follow-up as no new send', () => {
    const jobs = [
      job({ id: '1', status: 'skipped', events: [['found', at(11, 10)], ['skipped', at(11, 11)]] }),
      job({ id: '2', status: 'approved', events: [['found', at(11, 10)], ['approved', at(11, 11)]] }),
      job({ id: '3', sentBy: 'autonomous', events: [['applied', at(11, 2)], ['applied', at(11, 12)]] }),
    ];
    expect(weekCard(jobs, 15, now).sent).toBe(0);
  });

  it('caps blocks at 20 and says how many more reach the goal', () => {
    expect(weekCard([], 50, now).blocks).toEqual({ filled: 0, total: 20 });
    expect(weekCard([job({ sentBy: 'autonomous' })], 15, now).line).toBe('1 sent by Applio, 0 you applied yourself. 14 more to hit your goal by Sunday.');
  });

  it('says the goal is met', () => {
    const jobs = [job({ id: '1', sentBy: 'autonomous' }), job({ id: '2', sentBy: 'you-manual' })];
    const w = weekCard(jobs, 2, now);
    expect(w.pct).toBe(100);
    expect(w.line).toBe('1 sent by Applio, 1 you applied yourself. Goal met.');
  });
});

describe('budgetCard', () => {
  it('fills budget blocks in proportion', () => {
    expect(budgetCard(status({ tokensToday: 62_000 }))).toMatchObject({ pct: 41, blocks: { filled: 4, total: 8 }, stopped: false });
  });

  it('says AI is stopped when the budget is used', () => {
    expect(budgetCard(status({ tokensToday: 150_000, budgetStop: 'Daily budget used' }))).toMatchObject({ stopped: true, blocks: { filled: 8, total: 8 } });
  });
});

describe('sentSeries', () => {
  const jobs = [
    job({ id: '1', sentBy: 'autonomous', events: [['applied', at(11, 13)]] }),
    job({ id: '2', sentBy: 'you-manual', events: [['applied', at(11, 13)]] }),
    job({ id: '3', sentBy: 'you-telegram', events: [['applied', at(11, 4)]] }),
    job({ id: '4', sentBy: 'autonomous', events: [['applied', at(11, 3)]] }), // before the 10-day window
  ];

  it('buckets sent per day, ending today', () => {
    const s = sentSeries(jobs, 'day', now);
    expect(s.labels).toHaveLength(10);
    expect(s.labels.at(-1)).toBe('Today');
    expect(s.app.at(-1)).toBe(1);
    expect(s.you.at(-1)).toBe(1);
    expect(s.app[0]).toBe(1); // 4 Nov is the first of the 10 days
    expect(s.max).toBe(3);
  });

  it('buckets sent per week, ending this week', () => {
    const s = sentSeries(jobs, 'week', now);
    expect(s.labels).toHaveLength(8);
    expect(s.labels.at(-1)).toBe('This wk');
    expect(s.app.at(-1)).toBe(1);
    expect(s.you.at(-1)).toBe(1);
    expect(s.app.at(-2)).toBe(2); // 4 Nov (you-telegram counts as Applio) and 3 Nov
  });
});

describe('upNext', () => {
  it('counts replies, follow-ups due, new matches', () => {
    const jobs = [
      job({ id: '1', status: 'replied', events: [['applied', at(11, 1)], ['replied', at(11, 5)]] }),
      job({ id: '2', status: 'applied', events: [['applied', at(11, 1)]] }), // 12 days: due
      job({ id: '3', status: 'applied', events: [['applied', at(11, 12)]] }),
      job({ id: '4', status: 'scored', events: [['found', at(11, 13, 9)], ['scored', at(11, 13, 9)]] }),
      job({ id: '5', status: 'scored', events: [['found', at(11, 1)], ['scored', at(11, 1)]] }),
    ];
    const u = upNext(jobs, { followUpDays: 7, lastRunAt: at(11, 13, 8), sources: 6, now });
    expect(u).toMatchObject({ replies: 1, followUps: 1, newMatches: 1, sources: 6, lastRunAt: at(11, 13, 8) });
  });
});

describe('pipeline', () => {
  const jobs = [
    job({ id: '1', status: 'interview', events: [['found', at(11, 2)], ['scored', at(11, 2)], ['drafted', at(11, 3)], ['approved', at(11, 3)], ['applied', at(11, 4)], ['replied', at(11, 6)], ['interview', at(11, 8)]] }),
    job({ id: '2', status: 'rejected', events: [['found', at(11, 2)], ['scored', at(11, 2)], ['drafted', at(11, 3)], ['applied', at(11, 4)], ['rejected', at(11, 7)]] }),
    job({ id: '3', status: 'skipped', events: [['found', at(11, 5)], ['scored', at(11, 5)], ['skipped', at(11, 6)]] }),
    job({ id: '4', status: 'ghosted', events: [['found', at(9, 1)], ['scored', at(9, 1)], ['drafted', at(9, 2)], ['applied', at(9, 3)], ['ghosted', at(10, 3)]] }),
    job({ id: '5', status: 'found', events: [['found', at(11, 12)]] }),
  ];

  it('counts each pipeline stage from history', () => {
    const p = pipeline(jobs, 'all', now);
    expect(p.stages.map((s) => [s.label, s.n])).toEqual([['Found', 5], ['Matched', 4], ['Drafted', 3], ['Applied', 3], ['Replied', 1], ['Interview', 1], ['Offer', 0]]);
    expect(p.closed).toEqual({ rejected: 1, noReply: 1, skipped: 1 });
  });

  it('filters to this month', () => {
    const p = pipeline(jobs, 'month', now);
    expect(p.stages[0]?.n).toBe(4);
    expect(p.stages.find((s) => s.label === 'Applied')?.n).toBe(2);
    expect(p.closed).toEqual({ rejected: 1, noReply: 0, skipped: 1 });
  });

  it('gives conversion from the previous stage and scales bars to Found', () => {
    const p = pipeline(jobs, 'all', now);
    expect(p.stages[1]).toMatchObject({ conv: '80% of found', width: 80 });
    expect(p.stages[0]?.conv).toBe('every job found');
    expect(p.stages[6]?.width).toBe(0);
  });
});
