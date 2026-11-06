import { AppError } from '../../shared/errors';
import type { RunSummary } from '../../shared/types';
import { NoTargetRolesError } from './discover';

const HOUR = 3_600_000;

/** Run now while automation is paused (SPEC F6: pause stops discovery). */
export class AutomationPausedError extends AppError {
  constructor() {
    super('automation_paused', 'Automation is paused. Resume it to run discovery');
  }
}

export interface SchedulerPorts {
  now: () => Date;
  /** Hours between runs, read each time so a settings change applies at once. */
  intervalHours: () => number;
  /** When the last stored run finished (ISO), so the schedule survives restarts. */
  lastRunAt: () => string | undefined;
  isPaused: () => boolean;
  run: () => Promise<RunSummary>;
  /** Called when a run starts or ends, so main can push status to the page. */
  onChange: () => void;
  log: (message: string, err: unknown) => void;
}

export interface Scheduler {
  /** Starts a run if one is due. Main calls it every minute and on wake from sleep. */
  tick(): Promise<void>;
  /**
   * Starts a run now, or returns the one already running.
   * @throws AutomationPausedError while paused; the run's own error if it fails.
   */
  runNow(): Promise<RunSummary>;
  /** Undefined while paused. */
  nextRunAt(): string | undefined;
}

/**
 * Discovery every few hours (SPEC F2). Due is "last run + interval", checked on
 * each tick, so a run missed during sleep happens once on the first tick after
 * wake rather than once per missed slot.
 */
export function createScheduler(ports: SchedulerPorts): Scheduler {
  let running: Promise<RunSummary> | null = null;
  // A run that threw has no stored summary; without this the next tick would retry every minute.
  let lastFailedAt: number | undefined;

  const dueAt = () => {
    const last = Math.max(Date.parse(ports.lastRunAt() ?? '') || 0, lastFailedAt ?? 0);
    return last === 0 ? ports.now().getTime() : last + ports.intervalHours() * HOUR;
  };

  const start = () => {
    if (running) return running;
    ports.onChange();
    running = ports
      .run()
      .catch((err: unknown) => {
        // No target role yet isn't a failure: nothing was polled, so check again next tick (a fresh
        // install would otherwise wait a whole interval after the operator adds one).
        if (!(err instanceof NoTargetRolesError)) {
          lastFailedAt = ports.now().getTime();
          ports.log('[scheduler] run failed', err);
        }
        throw err;
      })
      .finally(() => {
        running = null;
        ports.onChange();
      });
    return running;
  };

  return {
    tick: async () => {
      if (ports.isPaused() || running || ports.now().getTime() < dueAt()) return;
      await start().catch(() => {}); // logged in start()
    },
    runNow: async () => {
      if (ports.isPaused()) throw new AutomationPausedError();
      return start();
    },
    nextRunAt: () => (ports.isPaused() ? undefined : new Date(dueAt()).toISOString()),
  };
}
