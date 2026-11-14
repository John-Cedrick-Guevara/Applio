import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useElapsed } from './use-elapsed';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useElapsed', () => {
  it('counts milliseconds while active, once a second', () => {
    const { result } = renderHook(() => useElapsed(true));
    expect(result.current).toBe(0);
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current).toBe(3000);
  });

  it('is 0 while inactive and starts over each time it becomes active', () => {
    const { result, rerender } = renderHook(({ on }) => useElapsed(on), { initialProps: { on: false } });
    act(() => void vi.advanceTimersByTime(5000));
    expect(result.current).toBe(0);
    rerender({ on: true });
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current).toBe(2000);
    rerender({ on: false });
    expect(result.current).toBe(0);
    rerender({ on: true });
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current).toBe(1000);
  });

  it('counts from a given start time, so a reload keeps the real elapsed time', () => {
    const from = Date.now() - 90_000;
    const { result } = renderHook(() => useElapsed(true, from));
    expect(result.current).toBeGreaterThanOrEqual(90_000);
  });
});
