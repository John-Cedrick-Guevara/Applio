import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStatus } from '../../shared/types';
import { createMockApi } from '../../shared/mock/mock-api';
import { renderWithApp } from '../../test/render';
import { ActivityBar } from './activity-bar';

/** Stands in for the preload's status channel, letting the test push like main does. */
const fakeEvents = () => {
  const listeners = new Set<(s: AppStatus) => void>();
  window.applioEvents = {
    onStatus: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return { push: (s: AppStatus) => act(() => listeners.forEach((l) => l(s))), listeners };
};

afterEach(() => {
  delete window.applioEvents;
});

const bar = () => screen.findByRole('region', { name: 'Activity' });

describe('ActivityBar', () => {
  it('updates from status pushes without navigation', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<ActivityBar />);
    expect(await bar()).toHaveTextContent(/Nothing running/);
    events.push({ ...(await api.getStatus()), drafting: ['j5'] });
    expect(await bar()).toHaveTextContent('Drafting 1 · you can keep working');
  });

  it('stops a scan from the bar', async () => {
    const events = fakeEvents();
    const api = createMockApi({ latencyMs: 0 });
    const stopScan = vi.fn(async () => {});
    renderWithApp(<ActivityBar />, { ...api, stopScan });
    await bar();
    events.push({ ...(await api.getStatus()), scan: { phase: 'fetching', startedAt: new Date().toISOString() } });
    expect(await bar()).toHaveTextContent(/Scanning · fetching posts · 0:0\d/);
    await userEvent.click(screen.getByRole('button', { name: 'Stop scan' }));
    expect(stopScan).toHaveBeenCalled();
  });

  it('pauses and resumes auto-send from the bar', async () => {
    const { api } = renderWithApp(<ActivityBar />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pause auto-send' }));
    expect(await bar()).toHaveTextContent('Auto-send paused · nothing goes out without your click');
    expect((await api.getStatus()).paused).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Resume auto-send' }));
    expect((await api.getStatus()).paused).toBe(false);
  });

  it('offers Raise budget at the hard stop', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<ActivityBar />);
    await bar();
    events.push({ ...(await api.getStatus()), tokensToday: 160_000, dailyTokenBudget: 150_000, budgetStop: "Today's Claude token budget is used up." });
    expect(await bar()).toHaveTextContent('AI paused · budget used');
    expect(screen.getByRole('link', { name: 'Raise budget' })).toHaveAttribute('href', '#/settings');
    expect(screen.getByRole('meter', { name: 'Tokens used today' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('opens to list what is running with links', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<ActivityBar />);
    await bar();
    events.push({ ...(await api.getStatus()), scan: { phase: 'scoring', startedAt: new Date().toISOString() }, drafting: ['j5', 'j6'] });
    await userEvent.click(screen.getByText(/Scanning ·/));
    const panel = screen.getByRole('list', { name: 'Running now' });
    expect(within(panel).getByRole('link', { name: /scan/i })).toHaveAttribute('href', '#/get-jobs');
    expect(within(panel).getByRole('link', { name: /2 drafts/ })).toHaveAttribute('href', '#/inbox');
  });

  it('points to Settings when the engine needs setup', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<ActivityBar />);
    await bar();
    events.push({ ...(await api.getStatus()), engineReady: false });
    expect(screen.getByRole('link', { name: 'Claude needs setup' })).toHaveAttribute('href', '#/settings');
  });

  it('says it could not load, with Retry, instead of vanishing', async () => {
    const api = createMockApi({ latencyMs: 0 });
    let fail = true;
    const flaky = { ...api, getSettings: async () => { if (fail) throw new Error('settings unreadable'); return api.getSettings(); } };
    renderWithApp(<ActivityBar />, flaky);
    expect(await bar()).toHaveTextContent("Couldn't load what Applio is doing.");
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await bar()).toHaveTextContent(/Nothing running/);
  });

  it('stops listening when it unmounts', async () => {
    const events = fakeEvents();
    const { unmount } = renderWithApp(<ActivityBar />);
    await bar();
    unmount();
    expect(events.listeners.size).toBe(0);
  });
});
