import { describe, expect, it, vi } from 'vitest';
import type { RunSummary } from '../../shared/types';
import { createScheduler, type SchedulerPorts } from './scheduler';

const HOUR = 3_600_000;
const summary = (at: string): RunSummary => ({ at, found: 1, newAfterDedup: 1, passedFilters: 1, drafted: 0 });

/** A scheduler over a fake clock; the "database" remembers the last run's time. */
const setup = ({ storedRunAt, ...over }: Partial<SchedulerPorts> & { storedRunAt?: string } = {}) => {
  let now = new Date('2026-11-05T00:00:00.000Z');
  let lastRunAt = storedRunAt;
  const run = vi.fn(async () => {
    lastRunAt = now.toISOString();
    return summary(lastRunAt);
  });
  const ports: SchedulerPorts = {
    now: () => now,
    intervalHours: () => 6,
    lastRunAt: () => lastRunAt,
    isPaused: () => false,
    run,
    onChange: vi.fn(),
    log: vi.fn(),
    ...over,
  };
  return { scheduler: createScheduler(ports), ports, run, advance: (ms: number) => (now = new Date(now.getTime() + ms)) };
};

describe('scheduler', () => {
  it('runs at once on the first tick when it has never run', async () => {
    const { scheduler, run } = setup();
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again only once the interval has passed', async () => {
    const { scheduler, run, advance } = setup();
    await scheduler.tick();
    advance(6 * HOUR - 60_000);
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(1);
    advance(60_000);
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('runs once, not once per missed slot, after a long sleep', async () => {
    const { scheduler, run, advance } = setup();
    await scheduler.tick();
    advance(20 * HOUR);
    await scheduler.tick();
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('catches up on launch when the stored last run is overdue', async () => {
    const { scheduler, run } = setup({ storedRunAt: '2026-11-04T12:00:00.000Z' });
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits when the stored last run is recent', async () => {
    const { scheduler, run } = setup({ storedRunAt: '2026-11-04T23:00:00.000Z' });
    await scheduler.tick();
    expect(run).not.toHaveBeenCalled();
    expect(scheduler.nextRunAt()).toBe('2026-11-05T05:00:00.000Z');
  });

  it('uses the interval from settings', async () => {
    const { scheduler } = setup({ storedRunAt: '2026-11-04T23:00:00.000Z', intervalHours: () => 4 });
    expect(scheduler.nextRunAt()).toBe('2026-11-05T03:00:00.000Z');
  });

  it('skips scheduled runs while paused and shows no next run', async () => {
    const { scheduler, run } = setup({ isPaused: () => true });
    await scheduler.tick();
    expect(run).not.toHaveBeenCalled();
    expect(scheduler.nextRunAt()).toBeUndefined();
  });

  it('refuses Run now while paused', async () => {
    const { scheduler, run } = setup({ isPaused: () => true });
    await expect(scheduler.runNow()).rejects.toThrow('Automation is paused. Resume it to run discovery');
    expect(run).not.toHaveBeenCalled();
  });

  it('returns the run in progress when Run now is pressed during it', async () => {
    let finish!: (s: RunSummary) => void;
    const run = vi.fn(() => new Promise<RunSummary>((resolve) => (finish = resolve)));
    const { scheduler } = setup({ run });
    const first = scheduler.runNow();
    const second = scheduler.runNow();
    await scheduler.tick();
    finish(summary('2026-11-05T00:00:00.000Z'));
    expect(await second).toEqual(await first);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('tells the page when a run starts and ends', async () => {
    const { scheduler, ports } = setup();
    await scheduler.runNow();
    expect(ports.onChange).toHaveBeenCalledTimes(2);
  });

  it('logs a run that throws, waits a full interval, then runs again', async () => {
    const run = vi.fn(async () => Promise.reject(new Error('database is locked')));
    const { scheduler, ports, advance } = setup({ run });
    await scheduler.tick();
    expect(ports.log).toHaveBeenCalledWith('[scheduler] run failed', expect.any(Error));
    advance(60_000);
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(1);
    advance(6 * HOUR);
    await scheduler.tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('still rejects Run now with the error, so the page can show it', async () => {
    const { scheduler } = setup({ run: async () => Promise.reject(new Error('database is locked')) });
    await expect(scheduler.runNow()).rejects.toThrow('database is locked');
  });
});
