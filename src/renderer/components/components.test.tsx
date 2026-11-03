import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AsyncState } from '../hooks/use-async';
import { AsyncView } from './async-view';

const state = <T,>(over: Partial<AsyncState<T>>): AsyncState<T> => ({
  data: null, error: null, loading: false, reload: vi.fn(), setData: vi.fn(), ...over,
});

describe('AsyncView', () => {
  it('shows a loading indicator before data arrives', () => {
    render(<AsyncView state={state({ loading: true })}>{() => <p>data</p>}</AsyncView>);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('shows a readable error with a working retry', async () => {
    const s = state<number>({ error: new Error('db locked') });
    render(<AsyncView state={s}>{() => <p>data</p>}</AsyncView>);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't load/i);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(s.reload).toHaveBeenCalled();
  });

  it('renders children with data, even while refreshing', () => {
    render(<AsyncView state={state({ data: 5, loading: true })}>{(n) => <p>value {n}</p>}</AsyncView>);
    expect(screen.getByText('value 5')).toBeInTheDocument();
  });
});
