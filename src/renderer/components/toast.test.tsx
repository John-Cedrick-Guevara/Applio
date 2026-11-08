import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './toast';

const Shows = ({ message }: { message: string }) => {
  const toast = useToast();
  useEffect(() => toast.show(message, 'success'), [toast, message]);
  return null;
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('toasts', () => {
  it('disappear on their own after a few seconds', () => {
    render(<ToastProvider><Shows message="Saved" /></ToastProvider>);
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_100));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('stay while the pointer is on them, and leave a moment after it moves away', () => {
    render(<ToastProvider><Shows message="Added" /></ToastProvider>);
    fireEvent.mouseEnter(screen.getByText('Added').parentElement!);
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText('Added')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByText('Added').parentElement!);
    act(() => vi.advanceTimersByTime(3_100));
    expect(screen.queryByText('Added')).not.toBeInTheDocument();
  });
});
