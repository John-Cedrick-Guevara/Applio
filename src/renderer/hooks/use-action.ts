import { useCallback, useRef, useState } from 'react';
import { useToast } from '../components/toast';

/**
 * Runs a user-triggered mutation with consistent feedback: a pending flag for
 * disabling buttons, an optional success toast, and on failure a readable
 * toast for the operator plus a full console log for developers.
 *
 * `label` is a lowercase verb phrase ("approve the draft") used in both messages.
 * One action runs at a time: a second call while one is in flight is ignored, since
 * `pending` only disables buttons after the next render and fast clicks land before it.
 * `error` keeps the last failure's message for an inline, persistent explanation;
 * `quiet` skips the toast when the caller shows that inline instead.
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  const run = useCallback(
    async <T>(label: string, fn: () => Promise<T>, successMessage?: string, options: { quiet?: boolean } = {}): Promise<T | undefined> => {
      if (inFlight.current) return undefined;
      inFlight.current = true;
      setPending(true);
      setError(undefined);
      try {
        const result = await fn();
        if (successMessage) toast.show(successMessage, 'success');
        return result;
      } catch (err) {
        console.error(`[action] failed to ${label}`, err);
        // API rejections carry operator-readable messages by contract (shared/api.ts).
        const detail = err instanceof Error && err.message ? err.message : 'Please try again.';
        setError(detail);
        if (!options.quiet) toast.show(`Couldn't ${label}. ${detail}`, 'error');
        return undefined;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending, error };
}
