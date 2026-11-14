import { useEffect, useState } from 'react';

/**
 * Milliseconds a wait has run, ticking once a second while `active`; 0 otherwise, and a fresh
 * count each time it becomes active. Pass `from` (a start time in ms) to count from a real start,
 * so a reload shows the true elapsed time.
 */
export function useElapsed(active: boolean, from?: number): number {
  const [startedAt, setStartedAt] = useState(() => from ?? Date.now());
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    if (!active) return;
    const start = from ?? Date.now();
    setStartedAt(start);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, from]);
  return active ? Math.max(0, now - startedAt) : 0;
}
