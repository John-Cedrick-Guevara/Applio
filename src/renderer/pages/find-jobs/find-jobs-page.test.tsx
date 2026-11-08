import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import FindJobsPage from './find-jobs-page';

describe('FindJobsPage', () => {
  it('starts a scan only when asked, then shows what it kept', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const run = vi.spyOn(api, 'runDiscovery');
    renderWithApp(<FindJobsPage />, api);
    await screen.findByRole('list', { name: 'Sources this scan checks' });
    expect(run).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    expect(run).toHaveBeenCalledTimes(1);
    const results = await screen.findByRole('region', { name: 'Scan results' });
    expect(within(results).getByRole('list', { name: 'What the scan kept' })).toHaveTextContent(/14\s*posts fetched.*11\s*new.*2\s*passed your filters.*0\s*drafted/);
    expect(results).toHaveTextContent('Scan finished: 2 jobs passed your filters, 0 drafted.');
    expect(within(results).getByRole('link', { name: 'Open Review' })).toHaveAttribute('href', '#/review');
  });

  it('lists the sources a scan checks, with where to change them', async () => {
    renderWithApp(<FindJobsPage />);
    const list = await screen.findByRole('list', { name: 'Sources this scan checks' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Change sources in Settings' })).toHaveAttribute('href', '#/settings');
  });

  it("says why it can't scan while the token budget is used up, and starts nothing", async () => {
    const api = createMockApi({ latencyMs: 0 });
    const spent = { ...api, getStatus: async () => ({ ...(await api.getStatus()), budgetStop: "Today's Claude token budget is used up (150,000 of 150,000)." }) };
    const run = vi.spyOn(spent, 'runDiscovery');
    renderWithApp(<FindJobsPage />, spent);
    expect(await screen.findByRole('alert')).toHaveTextContent("Today's Claude token budget is used up");
    await userEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByText("Can't scan until the token budget resets or is raised.")).toBeInTheDocument();
  });

  it("says so when every source has used today's polls", async () => {
    const api = createMockApi({ latencyMs: 0 });
    const capped = { ...api, getStatus: async () => ({ ...(await api.getStatus()), sourcesAtLimit: true }) };
    renderWithApp(<FindJobsPage />, capped);
    expect(await screen.findByText(/Every source has used today's polls/)).toBeInTheDocument();
  });

  it('shows a failed scan with its reason and a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = createMockApi({ latencyMs: 0 });
    const run = vi.spyOn(api, 'runDiscovery').mockRejectedValueOnce(new Error('RemoteOK is not answering.'));
    renderWithApp(<FindJobsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start scan' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The scan stopped. RemoteOK is not answering.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(run).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('region', { name: 'Scan results' })).toBeInTheDocument();
  });
});
