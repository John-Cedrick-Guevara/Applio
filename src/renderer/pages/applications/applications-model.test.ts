import { describe, expect, it } from 'vitest';
import type { Job, StatusEvent } from '../../../shared/types';
import { appStats, displayStatus, filterGroup, timeline } from './applications-model';

const now = new Date('2026-11-03T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

const job = (over: Partial<Job>): Job => ({
  id: 'x', sourceId: 's', sourceName: 'RemoteOK', company: 'C', title: 'T', url: '', location: '', employmentType: 'full-time',
  postedAt: '', status: 'applied', channel: 'email', description: '', tags: [], strengths: [], gaps: [], applyTarget: '',
  factsUsed: 12, tokensUsed: 18_200, score: 88, sentBy: 'autonomous', history: [{ status: 'applied', at: daysAgo(2) }], ...over,
});

const history = (...events: [StatusEvent['status'], number, string?][]) => events.map(([status, d, note]) => ({ status, at: daysAgo(d), note }));

describe('displayStatus', () => {
  it('flags applications without a reply after the follow-up window', () => {
    expect(displayStatus(job({ history: history(['applied', 8]) }), 7, now)).toBe('Follow-up due');
    expect(displayStatus(job({ history: history(['applied', 3]) }), 7, now)).toBe('Applied');
  });

  it('resets the window after a follow-up is sent', () => {
    expect(displayStatus(job({ history: history(['applied', 10], ['applied', 1, 'Follow-up sent']) }), 7, now)).toBe('Applied');
  });

  it('words ghosted applications as no reply', () => {
    expect(displayStatus(job({ status: 'ghosted' }), 7, now)).toBe('No reply');
  });
});

describe('filterGroup', () => {
  it('groups statuses into the filter pills', () => {
    expect(filterGroup('Follow-up due')).toBe('waiting');
    expect(filterGroup('Offer')).toBe('interview');
    expect(filterGroup('No reply')).toBe('closed');
  });
});

describe('appStats', () => {
  it('counts this month, replies, interviews and follow-ups due', () => {
    const jobs = [
      job({ status: 'replied' }),
      job({ status: 'interview' }),
      job({ history: history(['applied', 9]) }),
      job({ status: 'rejected', history: history(['applied', 40], ['rejected', 30]) }),
    ];
    expect(appStats(jobs, 7, now)).toEqual({ sentThisMonth: 2, replies: 2, interviews: 1, followUpsDue: 1 });
  });
});

describe('timeline', () => {
  it('turns history into readable events, ending with a follow-up nudge when due', () => {
    const events = timeline(job({ history: history(['found', 10], ['scored', 10], ['drafted', 10], ['applied', 9]) }), 7, now);
    expect(events.map((e) => e.title)).toEqual([
      'Found on RemoteOK', 'Scored 88', 'Resume and cover letter drafted', 'Sent via Email', 'No reply in 7 days',
    ]);
    expect(events[2]!.meta).toBe('18.2k tokens · 12 facts used');
    expect(events[3]!.meta).toMatch(/^Autonomous · /);
  });
});
