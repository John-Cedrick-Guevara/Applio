import { describe, expect, it } from 'vitest';
import type { Job, JobStatus } from '../../shared/types';
import { NO_REPLY_DAYS, silentApplications } from './no-reply';

const DAY = 86_400_000;
const NOW = new Date('2026-11-30T12:00:00.000Z');
const job = (id: string, status: JobStatus, daysAgo: number) =>
  ({ id, status, history: [{ status, at: new Date(NOW.getTime() - daysAgo * DAY).toISOString() }] }) as Job;

describe('silentApplications', () => {
  it('finds applications with no event for 21 days, and only those still waiting', () => {
    const jobs = [job('a', 'applied', 21), job('b', 'applied', 20.9), job('c', 'interview', 40), job('d', 'replied', 30)];
    expect(silentApplications(jobs, NOW)).toEqual(['a']);
    expect(NO_REPLY_DAYS).toBe(21);
  });

  it('counts a follow-up as contact, so the 21 days start again', () => {
    const followedUp = { ...job('a', 'applied', 30), history: [...job('a', 'applied', 30).history, { status: 'applied' as const, at: new Date(NOW.getTime() - 5 * DAY).toISOString(), note: 'Follow-up sent' }] };
    expect(silentApplications([followedUp], NOW)).toEqual([]);
  });
});
