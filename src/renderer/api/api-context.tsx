import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ApplioApi } from '../../shared/api';
import { createMockApi } from '../../shared/mock/mock-api';

const ApiContext = createContext<ApplioApi | null>(null);

/**
 * Picks the backend: the Electron preload bridge when present, otherwise the
 * in-memory mock so the UI runs in a plain browser during development.
 */
function resolveApi(): ApplioApi {
  if (window.applio) return window.applio;
  console.warn('[api] window.applio not found — using in-memory mock API');
  return {
    ...createMockApi(),
    openExternal: async (url) => {
      window.open(url, '_blank', 'noopener');
    },
  };
}

/** Provides the API to the tree. Tests pass their own `api` instance. */
export function ApiProvider({ api, children }: { api?: ApplioApi; children: ReactNode }) {
  const value = useMemo(() => api ?? resolveApi(), [api]);
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

/** Returns the API; throws if used outside `ApiProvider` (a wiring bug, not a runtime state). */
export function useApi(): ApplioApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}
