import { useEffect, useRef, useState } from 'react';

/**
 * A number that goes up whenever main reports that a job changed (a reply, a
 * send, a draft). Pages add it to their loader's deps so they show the change
 * without a manual refresh. The first push only sets the baseline.
 */
export function useJobsVersion(): number {
  const [changes, setChanges] = useState(0);
  const last = useRef<number | undefined>(undefined);
  useEffect(
    () =>
      window.applioEvents?.onStatus(({ jobsVersion }) => {
        if (jobsVersion === undefined) return;
        if (last.current !== undefined && jobsVersion !== last.current) setChanges((c) => c + 1);
        last.current = jobsVersion;
      }),
    [],
  );
  return changes;
}
