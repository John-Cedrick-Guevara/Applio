import { describe, expect, it, vi } from 'vitest';
import type { RunSummary } from '../../shared/types';
import { createScanRunner, type ScanRunnerPorts } from './scan-runner';

const summary = (at: string): RunSummary => ({ at, found: 1, newAfterDedup: 1, passedFilters: 1, drafted: 0 });

const setup = (over: Partial<ScanRunnerPorts> = {}) => {
  const ports: ScanRunnerPorts = { run: vi.fn(async () => summary('2026-11-05T00:00:00.000Z')), onChange: vi.fn(), log: vi.fn(), ...over };
  return { runner: createScanRunner(ports), ports };
};

describe('scan runner', () => {
  it('runs a scan when the operator asks', async () => {
    const { runner, ports } = setup();
    await expect(runner.runNow()).resolves.toMatchObject({ found: 1 });
    expect(ports.run).toHaveBeenCalledTimes(1);
  });

  it('returns the scan in progress when Run now is pressed during it', async () => {
    let finish!: (s: RunSummary) => void;
    const run = vi.fn(() => new Promise<RunSummary>((resolve) => (finish = resolve)));
    const { runner } = setup({ run });
    const first = runner.runNow();
    const second = runner.runNow();
    finish(summary('2026-11-05T00:00:00.000Z'));
    expect(await second).toEqual(await first);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('tells the page when a scan starts and ends', async () => {
    const { runner, ports } = setup();
    await runner.runNow();
    expect(ports.onChange).toHaveBeenCalledTimes(2);
  });

  it('logs a scan that throws and rejects with its error, so the page can show it', async () => {
    const { runner, ports } = setup({ run: async () => Promise.reject(new Error('database is locked')) });
    await expect(runner.runNow()).rejects.toThrow('database is locked');
    expect(ports.log).toHaveBeenCalledWith('[scan] run failed', expect.any(Error));
  });

  it('runs again after a failed scan', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(summary('2026-11-05T01:00:00.000Z'));
    const { runner } = setup({ run });
    await expect(runner.runNow()).rejects.toThrow('offline');
    await expect(runner.runNow()).resolves.toMatchObject({ at: '2026-11-05T01:00:00.000Z' });
  });
});
