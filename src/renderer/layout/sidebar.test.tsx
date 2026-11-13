import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppStatus } from '../../shared/types';
import { createMockApi } from '../../shared/mock/mock-api';
import { renderWithApp } from '../../test/render';
import { Sidebar } from './sidebar';

afterEach(() => {
  delete window.applioEvents;
});

describe('Sidebar', () => {
  it('offers one Get jobs button and no separate Find jobs entry', async () => {
    renderWithApp(<Sidebar />);
    expect(await screen.findByRole('link', { name: 'Get jobs' })).toHaveAttribute('href', '#/get-jobs');
    expect(screen.queryByRole('link', { name: /Find jobs|Add job/ })).not.toBeInTheDocument();
  });

  it('updates the Inbox badge when main reports a job changed, without navigation', async () => {
    const listeners = new Set<(s: AppStatus) => void>();
    window.applioEvents = { onStatus: (l) => { listeners.add(l); return () => listeners.delete(l); } };
    const api = createMockApi({ latencyMs: 0 });
    renderWithApp(<Sidebar />, api);
    const link = await screen.findByRole('link', { name: /Inbox/ });
    const before = Number((await within(link).findByLabelText(/need a decision/)).textContent);
    const status = await api.getStatus();
    act(() => listeners.forEach((l) => l({ ...status, jobsVersion: 1 })));
    await api.skipJob('j1');
    act(() => listeners.forEach((l) => l({ ...status, jobsVersion: 2 })));
    await waitFor(() => expect(within(link).getByLabelText(/need a decision/)).toHaveTextContent(String(before - 1)));
  });

  it('badges the Inbox with exactly its decisions', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const decisions = (await api.listJobs({ statuses: ['drafted', 'approved'] })).length + (await api.listQuestions()).length;
    renderWithApp(<Sidebar />, api);
    const link = await screen.findByRole('link', { name: /Inbox/ });
    expect(link).toHaveAttribute('href', '#/inbox');
    expect(await within(link).findByLabelText(`${decisions} need a decision`)).toHaveTextContent(String(decisions));
  });

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
