import { describe, expect, it, vi } from 'vitest';
import type { Autonomy, Job } from '../../shared/types';
import { autoSend, autoSendBlock, type AutoSendContext } from './auto-send';
import { SendBlockedError } from './send-application';

const job = (over: Partial<Job> = {}) => ({ id: 'j1', channel: 'email', score: 90, company: 'Acme', sourceId: 'himalayas', status: 'drafted', ...over }) as Job;
const ctx = (over: Partial<AutoSendContext> = {}): AutoSendContext => ({
  sourceAutonomy: 'autonomous' as Autonomy, autoSendThreshold: 85, blocklist: [], paused: false, ...over,
});

describe('autoSendBlock', () => {
  it('lets a job through when every gate passes', () => {
    expect(autoSendBlock(job(), ctx())).toBeUndefined();
  });

  it.each([
    ['its source is set to Draft → Approve', job(), ctx({ sourceAutonomy: 'draft' }), 'Its source is set to Draft → Approve.'],
    ['its channel is a platform', job({ channel: 'platform' }), ctx(), 'Platform jobs are never sent automatically.'],
    ['its channel is a career site', job({ channel: 'custom' }), ctx(), 'Career-site jobs are never sent automatically.'],
    ['it is an Upwork job', job({ channel: 'email', platform: 'Upwork' }), ctx(), 'Upwork proposals are never sent automatically.'],
    ['its score is below the auto-send score', job({ score: 84 }), ctx(), 'Its match score (84) is below the auto-send score (85).'],
    ['its company is blocklisted', job({ company: 'Acme, Inc.' }), ctx({ blocklist: ['acme'] }), 'Acme, Inc. is on your blocklist.'],
    ['automation is paused', job(), ctx({ paused: true }), 'Automation is paused.'],
    ['its post looks like it steers AI tools', job({ suspicious: 'The post addresses AI tools directly.' }), ctx(), 'The post addresses AI tools directly. Suspicious posts are never sent automatically.'],
    ['the AI budget is used up', job(), ctx({ budgetStop: "Today's Claude token budget is used up." }), "Today's Claude token budget is used up."],
  ])('holds a job when %s', (_label, j, c, reason) => {
    expect(autoSendBlock(j, c)).toBe(reason);
  });
});

describe('autoSend', () => {
  const ports = () => ({ send: vi.fn(async () => ({ ...job(), status: 'applied' as const, sentBy: 'autonomous' as const })), note: vi.fn() });

  it('sends a job that passes, as Autonomous', async () => {
    const p = ports();
    expect(await autoSend(job(), ctx(), p)).toBe('sent');
    expect(p.send).toHaveBeenCalledWith('j1');
  });

  it('leaves a held job in Review with the reason on its timeline', async () => {
    const p = ports();
    expect(await autoSend(job({ score: 80 }), ctx(), p)).toBe('held');
    expect(p.send).not.toHaveBeenCalled();
    expect(p.note).toHaveBeenCalledWith('j1', 'Not sent automatically: Its match score (80) is below the auto-send score (85).');
  });

  it('says nothing for a job whose source was never meant to send on its own', async () => {
    const p = ports();
    expect(await autoSend(job(), ctx({ sourceAutonomy: 'draft' }), p)).toBe('held');
    expect(p.note).not.toHaveBeenCalled();
  });

  it('keeps the job in Review with the reason when the send itself is blocked, such as at a daily cap', async () => {
    const p = ports();
    p.send.mockRejectedValueOnce(new SendBlockedError("Gmail's daily cap is reached (100 sends today). Applio sends again tomorrow."));
    expect(await autoSend(job(), ctx(), p)).toBe('held');
    expect(p.note).toHaveBeenCalledWith('j1', "Not sent automatically: Gmail's daily cap is reached (100 sends today). Applio sends again tomorrow.");
  });
});
