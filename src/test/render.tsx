import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { API_METHODS, type ApplioApi } from '../shared/api';
import { parseApiArgs } from '../shared/schemas';
import { ApiProvider } from '../renderer/api/api-context';
import { createMockApi } from '../shared/mock/mock-api';
import { ToastProvider } from '../renderer/components/toast';

/**
 * Checks every call's arguments the way main's IPC handlers do, so page tests
 * fail if the UI sends something the real app would reject (PR-9 MNB-1).
 */
const validated = (api: ApplioApi): ApplioApi =>
  Object.fromEntries(
    API_METHODS.map((m) => [m, async (...args: unknown[]) => (api[m] as (...a: unknown[]) => unknown)(...parseApiArgs(m, args))]),
  ) as unknown as ApplioApi;

/**
 * Renders a view with the same providers the app uses, backed by a fresh
 * zero-latency mock API. Returns the api so tests can assert on its state.
 */
export function renderWithApp(ui: ReactElement, api: ApplioApi = createMockApi({ latencyMs: 0 })) {
  const result = render(
    <ApiProvider api={validated(api)}>
      <ToastProvider>{ui}</ToastProvider>
    </ApiProvider>,
  );
  return { ...result, api };
}
