import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppStatus } from '../../shared/types';
import { createMockApi } from '../../shared/mock/mock-api';
import { renderWithApp } from '../../test/render';
import { ActivityBlock } from './activity-block';

afterEach(() => {
  delete window.applioEvents;
});

const base: Omit<AppStatus, 'tokensToday'> = { engine: 'claude-code', engineReady: true, paused: false, dailyTokenBudget: 100_000 };

function show(status: Partial<AppStatus>) {
  const api = createMockApi({ latencyMs: 0 });
  return renderWithApp(<ActivityBlock />, { ...api, getStatus: async () => ({ ...base, tokensToday: 0, ...status }) });
}

describe('ActivityBlock', () => {
  it('says a scan\'s phase', async () => {
    show({ scan: { phase: 'scoring', startedAt: new Date().toISOString() } });
    expect((await screen.findByText(/^Scanning/)).closest('[role=status]')).toHaveTextContent(/scoring matches/);
  });

  it('says drafting', async () => {
    show({ drafting: ['j1', 'j2'] });
    expect(await screen.findByText('Drafting 2')).toBeInTheDocument();
  });

  it('says nothing running with the last scan', async () => {
    show({ lastRun: { at: '2026-11-13T08:00:00.000Z', found: 1, newAfterDedup: 1, passedFilters: 1, drafted: 0 } });
    expect((await screen.findByText('Nothing running')).closest('[role=status]')).toHaveTextContent(/last scan/);
  });

  it('says AI paused when the budget is used', async () => {
    show({ budgetStop: 'Daily budget used', tokensToday: 100_000 });
    expect(await screen.findByText('AI paused')).toBeInTheDocument();
  });

  it('fills the blocks from today\'s use', async () => {
    const { container } = show({ tokensToday: 40_000 });
    await screen.findByText('Nothing running');
    const blocks = [...container.querySelectorAll('.activity-block-tok span')];
    expect(blocks).toHaveLength(10);
    expect(blocks.filter((b) => b.classList.contains('on'))).toHaveLength(4);
  });

  it('updates on a pushed status', async () => {
    const listeners = new Set<(s: AppStatus) => void>();
    window.applioEvents = { onStatus: (l) => { listeners.add(l); return () => listeners.delete(l); } };
    show({});
    await screen.findByText('Nothing running');
    act(() => listeners.forEach((l) => l({ ...base, tokensToday: 0, drafting: ['j1'] })));
    expect(await screen.findByText('Drafting 1')).toBeInTheDocument();
  });

  it('links to usage', async () => {
    show({});
    await screen.findByText('Nothing running');
    expect(screen.getByRole('link', { name: /Nothing running/ })).toHaveAttribute('href', '#/usage');
  });

  it('keeps the scan clock out of the live region', async () => {
    const { container } = show({ scan: { phase: 'scoring', startedAt: new Date().toISOString() } });
    await screen.findByText(/^Scanning/);
    expect(container.querySelector('.activity-block-clock')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link', { name: /^(?!.*\d:\d\d).*Scanning/ })).toBeInTheDocument();
  });

  it('fills at least one block for any use, and all ten only at the limit', async () => {
    const low = show({ tokensToday: 3_000 });
    await screen.findByText('Nothing running');
    expect(low.container.querySelectorAll('.activity-block-tok .on')).toHaveLength(1);
    low.unmount();
    const near = show({ tokensToday: 96_000 });
    await screen.findByText('Nothing running');
    expect(near.container.querySelectorAll('.activity-block-tok .on')).toHaveLength(9);
  });

  it('says so, and retries, when the status cannot load', async () => {
    const api = createMockApi({ latencyMs: 0 });
    let calls = 0;
    renderWithApp(<ActivityBlock />, { ...api, getStatus: async () => { if (calls++ === 0) throw new Error('down'); return { ...base, tokensToday: 0 }; } });
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByText(/Couldn't load/)).toBeInTheDocument();
    retry.click();
    expect(await screen.findByText('Nothing running')).toBeInTheDocument();
  });
});
