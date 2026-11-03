import { useCallback, useState } from 'react';
import { useToast } from '../components/toast';

/**
 * Runs a user-triggered mutation with consistent feedback: a pending flag for
 * disabling buttons, an optional success toast, and on failure a readable
 * toast for the operator plus a full console log for developers.
 *
 * `label` is a lowercase verb phrase ("approve the draft") used in both messages.
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async <T>(label: string, fn: () => Promise<T>, successMessage?: string): Promise<T | undefined> => {
      setPending(true);
      try {
        const result = await fn();
        if (successMessage) toast.show(successMessage, 'success');
        return result;
      } catch (err) {
        console.error(`[action] failed to ${label}`, err);
        // API rejections carry operator-readable messages by contract (shared/api.ts).
        const detail = err instanceof Error && err.message ? err.message : 'Please try again.';
        toast.show(`Couldn't ${label}. ${detail}`, 'error');
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending };
}
