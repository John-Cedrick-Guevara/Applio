import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  /** Re-runs the loader (e.g. after a mutation). */
  reload: () => void;
  /**
   * Replaces data locally — for applying a mutation result without refetching.
   * Accepts an updater (like React's setState) so callers never read stale data.
   */
  setData: (next: T | ((prev: T) => T)) => void;
}

/**
 * Runs an async loader on mount and whenever `deps` change, tracking
 * loading/error state. Stale responses from superseded runs are dropped so a
 * slow earlier request can never overwrite a newer one.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns deps, like useEffect
  const stableLoad = useCallback(load, deps);

  useEffect(() => {
    let current = true;
    setLoading(true);
    stableLoad()
      .then((value) => {
        if (!current) return;
        setData(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!current) return;
        const wrapped = err instanceof Error ? err : new Error(String(err));
        console.error('[useAsync] load failed', wrapped);
        setError(wrapped);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [stableLoad, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    // Updaters are skipped while nothing is loaded — there's nothing to update yet.
    setData((prev) => (typeof next === 'function' ? (prev === null ? prev : (next as (p: T) => T)(prev)) : next));
  }, []);

  return { data, error, loading, reload, setData: update };
}
