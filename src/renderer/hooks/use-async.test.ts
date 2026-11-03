import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsync } from './use-async';

describe('useAsync', () => {
  it('starts loading, then exposes data', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('exposes errors without throwing and logs them for developers', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useAsync(() => Promise.reject(new Error('boom')), []));
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
    expect(log).toHaveBeenCalled();
  });

  it('reloads on demand', async () => {
    let n = 0;
    const { result } = renderHook(() => useAsync(() => Promise.resolve(++n), []));
    await waitFor(() => expect(result.current.data).toBe(1));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('updates data locally with an updater', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve([1, 2]), []));
    await waitFor(() => expect(result.current.data).toEqual([1, 2]));
    act(() => result.current.setData((prev) => [...prev, 3]));
    expect(result.current.data).toEqual([1, 2, 3]);
  });

  it('ignores results from a superseded request', async () => {
    const resolvers: ((v: string) => void)[] = [];
    const { result, rerender } = renderHook(({ key }) => useAsync(() => new Promise<string>((r) => resolvers.push(r)), [key]), {
      initialProps: { key: 'a' },
    });
    rerender({ key: 'b' });
    act(() => resolvers[1]!('b'));
    act(() => resolvers[0]!('a'));
    await waitFor(() => expect(result.current.data).toBe('b'));
  });
});
