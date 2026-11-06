const FIRST_WAIT_MS = 5_000;
const LONGEST_WAIT_MS = 60_000;

/**
 * Keeps long-polling while `running()` says so (SPEC F9). A failed poll (the
 * network is down) waits 5 s, doubling up to 60 s; a good one resets the wait.
 * Each poll already blocks until something arrives, so there's no wait between good ones.
 */
export async function runPolling({ poll, sleep, running, log }: { poll: () => Promise<void>; sleep: (ms: number) => Promise<void>; running: () => boolean; log: (message: string, err: unknown) => void }) {
  let wait = FIRST_WAIT_MS;
  while (running()) {
    try {
      await poll();
      wait = FIRST_WAIT_MS;
    } catch (err) {
      log('[telegram] poll failed, retrying', err instanceof Error ? err.message : err);
      await sleep(wait);
      wait = Math.min(wait * 2, LONGEST_WAIT_MS);
    }
  }
}
