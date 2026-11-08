import type { RunSummary } from '../../shared/types';
import { NoTargetRolesError } from './discover';

export interface ScanRunnerPorts {
  run: () => Promise<RunSummary>;
  /** Called when a scan starts or ends, so main can push status to the page. */
  onChange: () => void;
  log: (message: string, err: unknown) => void;
}

export interface ScanRunner {
  /**
   * Starts a scan now, or returns the one already running.
   * @throws The scan's own error if it fails.
   */
  runNow(): Promise<RunSummary>;
}

/**
 * Discovery runs only when the operator starts it (SPEC F2), so no tokens are
 * spent without a click. One scan at a time: a second click joins the first.
 */
export function createScanRunner(ports: ScanRunnerPorts): ScanRunner {
  let running: Promise<RunSummary> | null = null;
  return {
    runNow: () => {
      if (running) return running;
      ports.onChange();
      running = ports
        .run()
        .catch((err: unknown) => {
          // No target role yet is the operator's next step, not a failure; the page says so.
          if (!(err instanceof NoTargetRolesError)) ports.log('[scan] run failed', err);
          throw err;
        })
        .finally(() => {
          running = null;
          ports.onChange();
        });
      return running;
    },
  };
}
