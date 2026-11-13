import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../../shared/mock/mock-api';
import { renderWithApp } from '../../test/render';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  it('counts new matches in the nav', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const lastRun = { at: '2000-01-01T00:00:00.000Z', found: 2, newAfterDedup: 2, passedFilters: 2, drafted: 0 };
    renderWithApp(<Sidebar />, { ...api, getStatus: async () => ({ ...(await api.getStatus()), lastRun }) });
    const link = await screen.findByRole('link', { name: /Matches/ });
    expect(await within(link).findByText('2 new')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#/matches');
  });

  it('shows no count when nothing is new since the last scan', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const lastRun = { at: '2999-01-01T00:00:00.000Z', found: 0, newAfterDedup: 0, passedFilters: 0, drafted: 0 };
    renderWithApp(<Sidebar />, { ...api, getStatus: async () => ({ ...(await api.getStatus()), lastRun }) });
    const link = await screen.findByRole('link', { name: /Matches/ });
    expect(link).not.toHaveTextContent(/new/);
  });
});
