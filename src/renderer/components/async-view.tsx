import type { ReactNode } from 'react';
import type { AsyncState } from '../hooks/use-async';
import { ErrorState, Loading } from './states';

interface AsyncViewProps<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  /** Noun used in the error message, e.g. "jobs". */
  what?: string;
  rows?: number;
}

/**
 * Renders the loading / error / data branches of an `useAsync` result the same
 * way everywhere. Keeps showing existing data during a refresh to avoid flicker.
 */
export function AsyncView<T>({ state, children, what, rows }: AsyncViewProps<T>) {
  if (state.data !== null) return <>{children(state.data)}</>;
  if (state.error) return <ErrorState what={what} onRetry={state.reload} />;
  return <Loading rows={rows} />;
}
