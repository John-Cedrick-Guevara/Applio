import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStatus } from '../../../shared/types';
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
    const enabled = (await api.listSources()).filter((src) => src.enabled && src.kind !== 'clip').map((src) => src.id);
    expect(run).toHaveBeenCalledWith({ sourceIds: enabled, draft: false });
    const results = await screen.findByRole('region', { name: 'Scan results' });
    expect(within(results).getByRole('list', { name: 'What the scan kept' })).toHaveTextContent(/14\s*posts fetched.*11\s*new.*2\s*passed your filters.*0\s*drafted/);
    expect(results).toHaveTextContent('Scan finished: 2 jobs passed your filters, 0 drafted.');
    expect(within(results).getByRole('link', { name: 'Open the 2 new matches' })).toHaveAttribute('href', '#/matches/new');
  });

  it("counts only the matches that wait in Matches, and sends drafted or asked jobs to the Inbox", async () => {
    const api = createMockApi({ latencyMs: 0 });
    // The page reads the stored run from status once the scan ends, so the fake serves it from both places.
    const run = (over: object) => {
      const summary = { at: new Date().toISOString(), found: 9, newAfterDedup: 6, passedFilters: 5, drafted: 0, ...over };
      return { ...api, runDiscovery: async () => summary, getStatus: async () => ({ ...(await api.getStatus()), lastRun: summary }) };
    };
    const { unmount } = renderWithApp(<FindJobsPage />, run({ drafted: 2, asked: 1 }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start scan' }));
    expect(await screen.findByRole('link', { name: 'Open the 2 new matches' })).toHaveAttribute('href', '#/matches/new');
    unmount();
    renderWithApp(<FindJobsPage />, run({ passedFilters: 3, drafted: 3 }));
    await userEvent.click(await screen.findByRole('button', { name: 'Start scan' }));
    expect(await screen.findByRole('link', { name: 'Open the Inbox' })).toHaveAttribute('href', '#/inbox');
  });

  it('scans only the sources left ticked, and drafts only when asked', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const run = vi.spyOn(api, 'runDiscovery');
    renderWithApp(<FindJobsPage />, api);
    const list = await screen.findByRole('list', { name: 'Sources this scan checks' });
    const [first, ...rest] = within(list).getAllByRole('checkbox');
    await userEvent.click(first!);
    expect(screen.getByText('None now. Draft any match from Matches.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /Also draft strong matches right away/ }));
    expect(screen.getByText('≈ 30k tokens per strong match, up to what is left today')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    const ids = (await api.listSources()).filter((src) => src.enabled && src.kind !== 'clip').map((src) => src.id);
    expect(run).toHaveBeenCalledWith({ sourceIds: ids.slice(1), draft: true });
    expect(rest.length).toBe(ids.length - 1);
  });

  it("states the scan's cost against today's budget", async () => {
    renderWithApp(<FindJobsPage />);
    await screen.findByRole('list', { name: 'Sources this scan checks' });
    expect(screen.getByText('≈ 6k tokens · 9% of the 68k left today')).toBeInTheDocument();
  });

  it('asks for at least one source before scanning', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const run = vi.spyOn(api, 'runDiscovery');
    renderWithApp(<FindJobsPage />, api);
    const list = await screen.findByRole('list', { name: 'Sources this scan checks' });
    for (const box of within(list).getAllByRole('checkbox')) await userEvent.click(box);
    await userEvent.click(screen.getByRole('button', { name: 'Start scan' }));
    expect(screen.getByText('Pick at least one source to scan.')).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it("follows the scan's phases as main reports them, and stops it on request", async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'runDiscovery').mockReturnValue(new Promise(() => {}));
    const stop = vi.spyOn(api, 'stopScan');
    const listeners = new Set<(s: AppStatus) => void>();
    window.applioEvents = { onStatus: (l) => (listeners.add(l), () => listeners.delete(l)) };
    renderWithApp(<FindJobsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Start scan' }));
    const status = { ...(await api.getStatus()), scan: { phase: 'scoring' as const, startedAt: new Date().toISOString() } };
    act(() => listeners.forEach((l) => l(status)));
    const steps = within(screen.getByRole('region', { name: 'Scan in progress' })).getByRole('list', { name: 'Scan steps' });
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Fetch postsDone', 'Remove duplicates and filter (free)Done', 'Score against your fact bankIn progress',
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Stop scan' }));
    expect(stop).toHaveBeenCalled();
    expect(screen.getByText('Stopping after this step. Everything found so far is kept.')).toBeInTheDocument();
    delete window.applioEvents;
  });

  it('lists the sources a scan checks, with where to change them', async () => {
    renderWithApp(<FindJobsPage />);
    const list = await screen.findByRole('list', { name: 'Sources this scan checks' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    // Clipped jobs come from the operator pasting them, never from a scan.
    expect(within(list).queryByText('Clipped jobs')).not.toBeInTheDocument();
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

  describe('while a scan runs', () => {
    afterEach(() => vi.useRealTimers());

    it('shows the moving bar with its words, and the slow-scan note at about three times the usual', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const api = createMockApi({ latencyMs: 0 });
      renderWithApp(<FindJobsPage />, { ...api, runDiscovery: () => new Promise(() => {}) });
      await userEvent.click(await screen.findByRole('button', { name: 'Start scan' }));
      const running = await screen.findByRole('region', { name: 'Scan in progress' });
      expect(running.querySelector('.indet')).not.toBeNull();
      expect(within(running).queryByText('The scan is taking longer than usual.')).not.toBeInTheDocument();
      await act(async () => void vi.advanceTimersByTime(3 * 60_000));
      expect(within(running).getByText('The scan is taking longer than usual.')).toBeInTheDocument();
      expect(running).toHaveTextContent('Everything found so far is kept, and you can stop it.');
      expect(within(running).getByRole('button', { name: 'Stop scan' })).toBeEnabled();
    });
  });
});
