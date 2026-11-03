import { useSyncExternalStore } from 'react';

/**
 * Minimal hash router. Hash URLs work unchanged under Electron's file://
 * loading, and the app has a handful of flat routes — a routing library
 * would be more code than it saves.
 */

export type RouteParams = Record<string, string>;

const trim = (path: string) => path.replace(/\/+$/, '') || '/';

/**
 * Matches `path` against a pattern like `/jobs/:id`.
 * @returns The decoded params, or null when the path doesn't match.
 */
export function matchRoute(pattern: string, path: string): RouteParams | null {
  const want = trim(pattern).split('/');
  const got = trim(path).split('/');
  if (want.length !== got.length) return null;

  const params: RouteParams = {};
  for (let i = 0; i < want.length; i++) {
    const w = want[i]!;
    const g = got[i]!;
    if (w.startsWith(':')) params[w.slice(1)] = decodeURIComponent(g);
    else if (w !== g) return null;
  }
  return params;
}

/** Current path from the hash, e.g. `#/jobs/j1` → `/jobs/j1`. */
const readPath = () => window.location.hash.replace(/^#/, '') || '/';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** Subscribes a component to the current hash path. */
export function usePath(): string {
  return useSyncExternalStore(subscribe, readPath, () => '/');
}

/** Navigates by updating the hash; listeners re-render via `usePath`. */
export function navigate(path: string): void {
  window.location.hash = path;
}
