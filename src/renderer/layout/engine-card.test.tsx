import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppStatus } from '../../shared/types';
import { renderWithApp } from '../../test/render';
import { EngineCard } from './engine-card';

/** Stands in for the preload's status channel, letting the test push like main does. */
const fakeEvents = () => {
  const listeners = new Set<(s: AppStatus) => void>();
  window.applioEvents = {
    onStatus: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return { push: (s: AppStatus) => listeners.forEach((l) => l(s)), listeners };
};

afterEach(() => {
  delete window.applioEvents;
});

describe('EngineCard', () => {
  it('shows status pushed from main without any navigation', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<EngineCard />);
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    const paused = { ...(await api.getStatus()), paused: true };
    act(() => events.push(paused));
    expect(screen.getByText('Paused', { selector: '.engine-state' })).toBeInTheDocument();
  });

  it('shows when the last scan ran, and never a next run', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<EngineCard />);
    await screen.findByText('Ready');
    const neverScanned = { ...(await api.getStatus()), lastRun: undefined };
    act(() => events.push(neverScanned));
    expect(screen.getByText('Last scan').nextSibling).toHaveTextContent('None yet');
    expect(screen.queryByText('Next run')).not.toBeInTheDocument();
  });

  it('stops listening when it unmounts', async () => {
    const events = fakeEvents();
    const { unmount } = renderWithApp(<EngineCard />);
    await screen.findByText('Ready');
    unmount();
    expect(events.listeners.size).toBe(0);
  });

  it('turns the token meter amber from 80% of the daily budget', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<EngineCard />);
    await screen.findByText('Ready');
    const busy = { ...(await api.getStatus()), tokensToday: 126_400, dailyTokenBudget: 150_000 };
    act(() => events.push(busy));
    expect(screen.getByRole('meter', { name: 'Tokens used today' })).toHaveClass('engine-meter-warn');
  });

  it('says AI is paused for the day, with a way to raise the budget, once the budget is used', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<EngineCard />);
    await screen.findByText('Ready');
    const base = await api.getStatus();
    act(() => events.push({ ...base, tokensToday: 261_300, dailyTokenBudget: 100_000, budgetStop: "Today's Claude token budget is used up." }));
    expect(screen.getByText('Paused · daily budget used')).toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Raise budget' })).toHaveAttribute('href', '#/settings');
  });

  it('rounds big token counts so the line fits the card', async () => {
    const events = fakeEvents();
    const { api } = renderWithApp(<EngineCard />);
    await screen.findByText('Ready');
    const base = await api.getStatus();
    act(() => events.push({ ...base, tokensToday: 226_900, dailyTokenBudget: 500_000 }));
    expect(screen.getByText('227k / 500k')).toBeInTheDocument();
  });
});
