import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { ApplioApi } from '../shared/api';
import { ApiProvider } from '../renderer/api/api-context';
import { createMockApi } from '../shared/mock/mock-api';
import { ToastProvider } from '../renderer/components/toast';

/**
 * Renders a view with the same providers the app uses, backed by a fresh
 * zero-latency mock API. Returns the api so tests can assert on its state.
 */
export function renderWithApp(ui: ReactElement, api: ApplioApi = createMockApi({ latencyMs: 0 })) {
  const result = render(
    <ApiProvider api={api}>
      <ToastProvider>{ui}</ToastProvider>
    </ApiProvider>,
  );
  return { ...result, api };
}
