import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHeldAction } from './use-held-action';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useHeldAction', () => {
  it('commits after the delay, once', async () => {
    const commit = vi.fn(async () => {});
    const { result } = renderHook(() => useHeldAction(commit, 5000));
    act(() => result.current.hold(['a', 'b'], 'Skipped 2.'));
    expect(result.current.held).toEqual({ ids: ['a', 'b'], message: 'Skipped 2.' });
    await act(async () => { vi.advanceTimersByTime(4999); });
    expect(commit).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(['a', 'b']);
    expect(result.current.held).toBeNull();
  });

  it('undo cancels the commit', async () => {
    const commit = vi.fn(async () => {});
    const { result } = renderHook(() => useHeldAction(commit, 5000));
    act(() => result.current.hold(['a'], 'Skipped.'));
    act(() => result.current.undo());
    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.held).toBeNull();
  });

  it('commits the held action at once when a new one is held', async () => {
    const commit = vi.fn(async () => {});
    const { result } = renderHook(() => useHeldAction(commit, 5000));
    act(() => result.current.hold(['a'], 'Skipped a.'));
    await act(async () => { result.current.hold(['b'], 'Skipped b.'); });
    expect(commit).toHaveBeenCalledWith(['a']);
    expect(result.current.held?.ids).toEqual(['b']);
  });

  it('commits a held action on unmount, so leaving the page keeps it', () => {
    const commit = vi.fn(async () => {});
    const { result, unmount } = renderHook(() => useHeldAction(commit, 5000));
    act(() => result.current.hold(['a'], 'Skipped.'));
    unmount();
    expect(commit).toHaveBeenCalledWith(['a']);
  });
});
