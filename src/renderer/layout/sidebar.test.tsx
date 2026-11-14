import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStatus } from '../../shared/types';
import { createMockApi } from '../../shared/mock/mock-api';
import { renderWithApp } from '../../test/render';
import { Sidebar } from './sidebar';

afterEach(() => {
  delete window.applioEvents;
  localStorage.clear();
  vi.restoreAllMocks();
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
    await waitFor(() => expect(link).toHaveTextContent('2 new'));
    expect(link).toHaveAttribute('href', '#/matches');
  });

  it('shows no count when nothing is new since the last scan', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const lastRun = { at: '2999-01-01T00:00:00.000Z', found: 0, newAfterDedup: 0, passedFilters: 0, drafted: 0 };
    renderWithApp(<Sidebar />, { ...api, getStatus: async () => ({ ...(await api.getStatus()), lastRun }) });
    const link = await screen.findByRole('link', { name: /Matches/ });
    expect(link).not.toHaveTextContent(/new/);
  });

  it('collapses to icons and expands again, announcing its state', async () => {
    const user = userEvent.setup();
    renderWithApp(<Sidebar />);
    const toggle = await screen.findByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(toggle);
    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('complementary')).toHaveAttribute('data-collapsed', 'true');
    await user.click(expand);
    expect(screen.getByRole('complementary')).toHaveAttribute('data-collapsed', 'false');
  });

  it('remembers the choice', async () => {
    const user = userEvent.setup();
    const first = renderWithApp(<Sidebar />);
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
    first.unmount();
    renderWithApp(<Sidebar />);
    expect(await screen.findByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('opens expanded when storage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const user = userEvent.setup();
    renderWithApp(<Sidebar />);
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('keeps names, titles and counts when collapsed', async () => {
    const user = userEvent.setup();
    renderWithApp(<Sidebar />);
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }));
    const inbox = screen.getByRole('link', { name: /Inbox/ });
    expect(inbox).toHaveAttribute('title', 'Inbox');
    expect(await within(inbox).findByLabelText(/need a decision/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Usage & limits' })).toHaveAttribute('title', 'Usage & limits');
  });

  it('lists the pages in order with the current one marked', async () => {
    window.location.hash = '#/applications';
    renderWithApp(<Sidebar />);
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('title'))).toEqual(['Dashboard', 'Inbox', 'Matches', 'Get jobs', 'Applications', 'Profile', 'Usage & limits', 'Settings']);
    expect(within(nav).getByRole('link', { name: 'Applications' })).toHaveAttribute('aria-current', 'page');
    window.location.hash = '';
  });

  it('links the logo home', async () => {
    renderWithApp(<Sidebar />);
    expect(await screen.findByRole('link', { name: 'Applio, home' })).toHaveAttribute('href', '#/dashboard');
  });

  it('names the counts for screen readers, open or collapsed', async () => {
    const user = userEvent.setup();
    const api = createMockApi({ latencyMs: 0 });
    const lastRun = { at: '2000-01-01T00:00:00.000Z', found: 2, newAfterDedup: 2, passedFilters: 2, drafted: 0 };
    renderWithApp(<Sidebar />, { ...api, getStatus: async () => ({ ...(await api.getStatus()), lastRun }) });
    expect(await screen.findByRole('link', { name: /Inbox.*need a decision/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(await screen.findByRole('link', { name: /Inbox, \d+ need a decision/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Matches, 2 new' })).toBeInTheDocument();
  });

  it('renders the logo as a 34px tile with a 10px corner', async () => {
    const { container } = renderWithApp(<Sidebar />);
    await screen.findByRole('link', { name: 'Applio, home' });
    const svg = container.querySelector('svg.logo')!;
    expect(svg).toHaveAttribute('width', '34');
    expect(svg.querySelector('rect')).toHaveAttribute('rx', '10');
  });
});
