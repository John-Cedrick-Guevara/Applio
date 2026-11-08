import { afterEach, describe, expect, it, vi } from 'vitest';
import { withDeadline } from './deadline';

describe('withDeadline', () => {
  afterEach(() => vi.useRealTimers());

  it('rejects with the given message when the work outlasts the deadline', async () => {
    vi.useFakeTimers();
    const never = new Promise<string>(() => {});
    const result = expect(withDeadline(never, 1_000, 'printing took longer than 1 s')).rejects.toThrow('printing took longer than 1 s');
    await vi.advanceTimersByTimeAsync(1_000);
    await result;
  });

  it('passes the result through when the work finishes in time', async () => {
    await expect(withDeadline(Promise.resolve('pdf'), 1_000, 'late')).resolves.toBe('pdf');
  });
});
