import { useEffect, useRef, useState } from 'react';

/**
 * Milliseconds a wait has run, ticking once a second while `active`; 0 otherwise, and a fresh
 * count each time it becomes active (0 on the very first render of a run, never the last run's
 * value). Pass `from` (a start time in ms) to count from a real start, so a reload shows the
 * true elapsed time; an unreadable `from` is ignored.
 */
export function useElapsed(active: boolean, from?: number): number {
  const started = useRef<number | undefined>(undefined);
  const [, tick] = useState(0);
  // Set while rendering, so the first render of a run already counts from its start.
  if (!active) started.current = undefined;
  else if (started.current === undefined) started.current = Date.now();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);
  if (!active) return 0;
  const begin = from !== undefined && Number.isFinite(from) ? from : started.current!;
  return Math.max(0, Date.now() - begin);
}
