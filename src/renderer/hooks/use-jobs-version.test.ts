import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppStatus } from '../../shared/types';
import { useJobsVersion } from './use-jobs-version';

/** A fake main process: every hook subscribes, and `push` reaches them all. */
const fakeMain = () => {
  const listeners = new Set<(s: AppStatus) => void>();
  window.applioEvents = { onStatus: (l) => (listeners.add(l), () => listeners.delete(l)) };
  return (jobsVersion: number) => act(() => listeners.forEach((l) => l({ jobsVersion } as AppStatus)));
};

describe('useJobsVersion', () => {
  it('reloads on the first change after mount when an earlier push already set the version', () => {
    const push = fakeMain();
    renderHook(() => useJobsVersion());
    push(1);
    // A panel opened now (e.g. a draft that just landed) must react to the very next change: the PDFs saving.
    const { result } = renderHook(() => useJobsVersion());
    push(2);
    expect(result.current).toBe(1);
  });

  it('does not reload when the version has not moved', () => {
    const push = fakeMain();
    const { result } = renderHook(() => useJobsVersion());
    push(4);
    push(4);
    expect(result.current).toBe(0);
  });
});
