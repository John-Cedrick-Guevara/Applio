import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/toast';
import { useAction } from './use-action';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

describe('useAction', () => {
  it('returns the result and shows the success message', async () => {
    const { result } = renderHook(() => useAction(), { wrapper });
    let value: number | undefined;
    await act(async () => {
      value = await result.current.run('save', () => Promise.resolve(7), 'Saved');
    });
    expect(value).toBe(7);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('shows a readable error to the operator and logs details for developers', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.run('approve the draft', () => Promise.reject(new Error('Daily limit reached')));
    });
    expect(screen.getByText("Couldn't approve the draft. Daily limit reached")).toBeInTheDocument();
    expect(log).toHaveBeenCalledWith('[action] failed to approve the draft', expect.any(Error));
  });

  it('runs one action at a time, so a fast double click calls the API once', async () => {
    let finish: (v: number) => void = () => {};
    const fn = vi.fn(() => new Promise<number>((resolve) => (finish = resolve)));
    const { result } = renderHook(() => useAction(), { wrapper });
    let second: number | undefined = 1;
    await act(async () => {
      const first = result.current.run('send', fn);
      second = await result.current.run('send', fn);
      finish(7);
      await first;
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(second).toBeUndefined();
  });

  it('keeps the last error for inline display, without a toast when asked to stay quiet', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useAction(), { wrapper });
    await act(async () => {
      await result.current.run('send', () => Promise.reject(new Error('Gmail refused')), undefined, { quiet: true });
    });
    expect(result.current.error).toBe('Gmail refused');
    expect(screen.queryByText(/Couldn't send/)).not.toBeInTheDocument();
    await act(async () => {
      await result.current.run('send', () => Promise.resolve(1));
    });
    expect(result.current.error).toBeUndefined();
  });
});
