import { appendFileSync, renameSync, statSync } from 'node:fs';
import { AppError } from '../../shared/errors';

/** Past this size the log moves to `<path>.1`, so it can't grow without bound. */
export const MAX_LOG_BYTES = 1_000_000;

/**
 * Appends one line for a failed call to the operator's log file, so a failure can
 * be diagnosed after the fact without a terminal. Takes only the error, never the
 * call's arguments, which may hold secrets or pasted posts. Logging must not make
 * a failure worse, so a write error is reported to the console and swallowed.
 */
export function appendErrorLog(path: string, method: string, err: unknown, now: Date = new Date()): void {
  const code = err instanceof AppError ? err.code : 'error';
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error && err.cause !== undefined ? ` cause=${JSON.stringify(String(err.cause))}` : '';
  try {
    if (sizeOf(path) > MAX_LOG_BYTES) renameSync(path, `${path}.1`);
    appendFileSync(path, `${now.toISOString()} ${method} ${code} ${JSON.stringify(message)}${cause}\n`);
  } catch (writeErr) {
    console.error('[log] could not write the error log', writeErr);
  }
}

const sizeOf = (path: string): number => {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
};
