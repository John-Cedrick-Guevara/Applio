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

  describe('what the top bar used to say', () => {
    it('says auto-send is off, on or paused, in words', async () => {
      const off = show({});
      expect(await screen.findByText('Auto-send off')).toBeInTheDocument();
      off.unmount();
      const paused = show({ paused: true });
      expect(await screen.findByText('Auto-send paused')).toBeInTheDocument();
      paused.unmount();
      const api = createMockApi({ latencyMs: 0 });
      await api.updateSource('remotive', { enabled: true, autonomy: 'autonomous' });
      renderWithApp(<ActivityBlock />, { ...api, getStatus: async () => ({ ...base, tokensToday: 0 }) });
      expect(await screen.findByText(/^Auto-send on/)).toBeInTheDocument();
    });

    it('points to Settings > Guardrails to raise the budget when AI is stopped by it', async () => {
      show({ budgetStop: 'Daily budget used', tokensToday: 100_000 });
      const link = await screen.findByRole('link', { name: /AI paused/ });
      expect(link).toHaveAttribute('href', '#/settings/guard');
      expect(link).toHaveTextContent('Raise the budget in Settings');
    });

    it('points to Settings > Connections when Claude is not set up', async () => {
      show({ engineReady: false });
      const link = await screen.findByRole('link', { name: /Claude needs setup/ });
      expect(link).toHaveAttribute('href', '#/settings/conn');
    });

    it('links a running scan to Get jobs, where Stop scan is', async () => {
      show({ scan: { phase: 'fetching', startedAt: new Date().toISOString() } });
      expect(await screen.findByRole('link', { name: /Scanning/ })).toHaveAttribute('href', '#/get-jobs');
    });

    it('stops listening when it unmounts', async () => {
      const listeners = new Set<(s: AppStatus) => void>();
      window.applioEvents = { onStatus: (l) => { listeners.add(l); return () => listeners.delete(l); } };
      const view = show({});
      await screen.findByText('Nothing running');
      view.unmount();
      expect(listeners.size).toBe(0);
    });
  
    it('still leads with the budget stop while a scan runs, and says the scan is running', async () => {
      show({ budgetStop: 'Daily budget used', tokensToday: 100_000, scan: { phase: 'scoring', startedAt: new Date().toISOString() } });
      const link = await screen.findByRole('link', { name: /AI paused/ });
      expect(link).toHaveAttribute('href', '#/settings/guard');
      expect(link).toHaveTextContent('A scan is running');
    });

    it('leads with Claude needing setup even while a scan runs, and says so', async () => {
      show({ engineReady: false, scan: { phase: 'fetching', startedAt: new Date().toISOString() } });
      const link = await screen.findByRole('link', { name: /Claude needs setup/ });
      expect(link).toHaveTextContent('A scan is running');
    });

    it('fills a block for tiny use and not all ten just below the limit', async () => {
      const tiny = show({ tokensToday: 500, dailyTokenBudget: 150_000 });
      await screen.findByText('Nothing running');
      expect(tiny.container.querySelectorAll('.activity-block-tok .on')).toHaveLength(1);
      tiny.unmount();
      const near = show({ tokensToday: 149_400, dailyTokenBudget: 150_000 });
      await screen.findByText('Nothing running');
      expect(near.container.querySelectorAll('.activity-block-tok .on')).toHaveLength(9);
    });

    it('marks a paused or blocked state with a glyph, not colour alone', async () => {
      const { container } = show({ paused: true });
      await screen.findByText('Auto-send paused');
      expect(container.querySelector('.activity-block-dot-warn')).toHaveTextContent('!');
    });

    it('follows a settings change on the same page without navigation', async () => {
      const api = createMockApi({ latencyMs: 0 });
      renderWithApp(<ActivityBlock />, { ...api, getStatus: async () => ({ ...base, tokensToday: 0 }) });
      expect(await screen.findByText('Auto-send off')).toBeInTheDocument();
      await api.updateSource('remotive', { enabled: true, autonomy: 'autonomous' });
      act(() => void window.dispatchEvent(new Event('applio:settings-changed')));
      expect(await screen.findByText(/^Auto-send on/)).toBeInTheDocument();
    });
  });
});
