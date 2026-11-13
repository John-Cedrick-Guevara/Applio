import { useCallback, useEffect, useRef, useState } from 'react';

interface Held {
  ids: string[];
  message: string;
}

/**
 * Holds an action that can't be reversed in main (skipping is final) for a few
 * seconds so the operator can Undo it. The rows hide at once; the commit runs when
 * the delay ends, when another action is held, or when the page unmounts, so
 * leaving the page never loses it. Commit errors are the caller's to report.
 */
export function useHeldAction(commit: (ids: string[]) => Promise<void>, delayMs = 5000) {
  const [held, setHeld] = useState<Held | null>(null);
  const heldRef = useRef<Held | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  /** Runs the held commit now (if any) and clears it. */
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const current = heldRef.current;
    heldRef.current = null;
    setHeld(null);
    if (current) void commitRef.current(current.ids);
  }, []);

  const hold = useCallback((ids: string[], message: string) => {
    flush();
    const next = { ids, message };
    heldRef.current = next;
    setHeld(next);
    timer.current = setTimeout(flush, delayMs);
  }, [flush, delayMs]);

  const undo = useCallback(() => {
    clearTimeout(timer.current);
    heldRef.current = null;
    setHeld(null);
  }, []);

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (heldRef.current) void commitRef.current(heldRef.current.ids);
  }, []);

  return { held, hold, undo };
}
