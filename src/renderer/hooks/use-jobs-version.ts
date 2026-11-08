import { useEffect, useRef, useState } from 'react';
import type { ApplioEvents } from '../../shared/api';

// The latest version each event source has pushed, so a hook mounted later starts from it.
const latestBySource = new WeakMap<ApplioEvents, number>();

/**
 * A number that goes up whenever main reports that a job changed (a reply, a
 * send, a draft). Pages add it to their loader's deps so they show the change
 * without a manual refresh. A hook mounted after a push starts from the latest
 * version seen, so its very first push already counts: a draft panel opened mid-draft
 * must reload when the PDFs land, and that may be the only push it ever gets.
 */
export function useJobsVersion(): number {
  const [changes, setChanges] = useState(0);
  const events = window.applioEvents;
  const last = useRef<number | undefined>(events ? latestBySource.get(events) : undefined);
  useEffect(
    () =>
      events?.onStatus(({ jobsVersion }) => {
        if (jobsVersion === undefined) return;
        if (last.current !== undefined && jobsVersion !== last.current) setChanges((c) => c + 1);
        last.current = jobsVersion;
        latestBySource.set(events, jobsVersion);
      }),
    [events],
  );
  return changes;
}
