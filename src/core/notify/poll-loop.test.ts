import { describe, expect, it, vi } from 'vitest';
import { runPolling } from './poll-loop';

describe('runPolling', () => {
  it('backs off 5 s, doubling to 60 s, while the network is down, and resets once it is back', async () => {
    const outcomes = [false, false, false, false, false, true, false];
    let turns = 0;
    const poll = vi.fn(async () => {
      if (!outcomes[turns++]) throw new Error("Couldn't reach Telegram.");
    });
    const sleep = vi.fn(async (_ms: number) => {});
    await runPolling({ poll, sleep, running: () => turns < outcomes.length, log: vi.fn() });
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([5000, 10000, 20000, 40000, 60000, 5000]);
  });

  it('stops when told to', async () => {
    const poll = vi.fn(async () => {});
    await runPolling({ poll, sleep: async () => {}, running: () => poll.mock.calls.length < 3, log: vi.fn() });
    expect(poll).toHaveBeenCalledTimes(3);
  });
});
