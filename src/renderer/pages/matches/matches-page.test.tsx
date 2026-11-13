import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { ApiProvider } from '../../api/api-context';
import { ToastProvider } from '../../components/toast';
import { renderWithApp } from '../../../test/render';
import MatchesPage from './matches-page';

const ORBITAL = 'Senior Software Engineer, Platform';
const FERNWOOD = 'Frontend Developer';

/** A mock where the draft bar is 60, so Orbital (67) is a strong match. */
async function setup(over: Partial<ReturnType<typeof createMockApi>> = {}) {
  const api = createMockApi({ latencyMs: 0 });
  await api.saveSettings({ draftThreshold: 60 });
  const view = renderWithApp(<MatchesPage />, { ...api, ...over });
  const list = await screen.findByRole('region', { name: 'Match list' });
  await within(list).findByText(ORBITAL);
  return { ...view, api, list };
}

const row = (list: HTMLElement, title: string) => within(list).getByText(title).closest('tr')!;

describe('MatchesPage', () => {
  it('says drafts go to the Inbox, now that Review is the Inbox', async () => {
    await setup();
    expect(screen.getByText(/drafts go to the Inbox when ready/)).toBeInTheDocument();
  });

  it('lists matches with no draft, best score first, unscored last', async () => {
    const { list } = await setup();
    const titles = within(list).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(titles[0]).toContain(ORBITAL);
    expect(titles[1]).toContain(FERNWOOD);
  });

  it('moves the draft bar, recounts and saves it', async () => {
    const { api } = await setup();
    const slider = screen.getByRole('slider', { name: /Draft bar/ });
    expect(screen.getByText('1 match at or above.')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '70' } });
    expect(screen.getByText('0 matches at or above.')).toBeInTheDocument();
    await waitFor(async () => expect((await api.getSettings()).draftThreshold).toBe(70));
  });

  it('saves a moved draft bar even when the page closes right away', async () => {
    const { api, unmount } = await setup();
    fireEvent.change(screen.getByRole('slider', { name: /Draft bar/ }), { target: { value: '72' } });
    unmount();
    await waitFor(async () => expect((await api.getSettings()).draftThreshold).toBe(72));
  });

  it('stops the draft bar at the auto-send score and says why', async () => {
    await setup();
    expect(screen.getByRole('slider', { name: /Draft bar/ })).toHaveAttribute('max', '85');
    expect(screen.getByText('Auto-send is at 85, so the bar stops there.')).toBeInTheDocument();
  });

  it('drafts one match, showing its cost', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const draftJob = vi.fn(api.draftJob);
    const { list } = await setup({ draftJob });
    await userEvent.click(within(row(list, ORBITAL)).getByRole('button', { name: 'Draft · ≈ 30k' }));
    expect(draftJob).toHaveBeenCalledWith('j5');
  });

  it('scores an unscored job on request, showing its cost', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const scoreJob = vi.fn(api.scoreJob);
    const { list } = await setup({ scoreJob });
    expect(row(list, FERNWOOD)).toHaveTextContent('Not scored yet. Score it now, or your next scan will.');
    expect(within(row(list, FERNWOOD)).queryByRole('button', { name: /Draft/ })).not.toBeInTheDocument();
    await userEvent.click(within(row(list, FERNWOOD)).getByRole('button', { name: 'Score · ≈ 2k' }));
    expect(scoreJob).toHaveBeenCalledWith('j6');
    expect(await within(row(list, FERNWOOD)).findByText('71')).toBeInTheDocument();
  });

  it('scores the unscored jobs in a selection', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const scoreJob = vi.fn(api.scoreJob);
    const { list } = await setup({ scoreJob });
    await userEvent.click(within(row(list, FERNWOOD)).getByRole('checkbox'));
    await userEvent.click(within(screen.getByRole('region', { name: 'Selected' })).getByRole('button', { name: 'Score 1' }));
    expect(scoreJob).toHaveBeenCalledWith('j6');
  });

  it('drafts a selection, leaving unscored jobs out and saying so', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const draftJob = vi.fn(api.draftJob);
    const { list } = await setup({ draftJob });
    await userEvent.click(within(row(list, ORBITAL)).getByRole('checkbox'));
    await userEvent.click(within(row(list, FERNWOOD)).getByRole('checkbox'));
    const selected = screen.getByRole('region', { name: 'Selected' });
    expect(selected).toHaveTextContent('2 selected');
    expect(selected).toHaveTextContent('1 not scored yet is left out of drafting.');
    await userEvent.click(within(selected).getByRole('button', { name: 'Draft 1' }));
    expect(draftJob).toHaveBeenCalledTimes(1);
    expect(draftJob).toHaveBeenCalledWith('j5');
  });

  it('disables Draft n over budget, with the reason beside it', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const getStatus = async () => ({ ...(await api.getStatus()), tokensToday: 140_000, dailyTokenBudget: 150_000 });
    const { list } = await setup({ getStatus });
    await userEvent.click(within(row(list, ORBITAL)).getByRole('checkbox'));
    const selected = screen.getByRole('region', { name: 'Selected' });
    expect(within(selected).getByRole('button', { name: 'Draft 1' })).toBeDisabled();
    expect(selected).toHaveTextContent('About 30k tokens is more than the 10k left today. Pick 0 or fewer, or raise the budget.');
  });

  it('skips with undo, then for good once the page closes', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const skipJob = vi.fn(api.skipJob);
    const { list, unmount } = await setup({ skipJob });
    await userEvent.click(within(row(list, ORBITAL)).getByRole('button', { name: 'Skip' }));
    expect(within(list).queryByText(ORBITAL)).not.toBeInTheDocument();
    const undo = screen.getByRole('status', { name: 'Undo' });
    expect(undo).toHaveTextContent(`Skipped ${ORBITAL}.`);
    await userEvent.click(within(undo).getByRole('button', { name: 'Undo' }));
    expect(within(list).getByText(ORBITAL)).toBeInTheDocument();
    expect(skipJob).not.toHaveBeenCalled();
    await userEvent.click(within(row(list, ORBITAL)).getByRole('button', { name: 'Skip' }));
    unmount();
    expect(skipJob).toHaveBeenCalledWith('j5');
  });

  it('keeps a skipped row hidden once the skip is saved', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const skipJob = vi.fn(api.skipJob);
    const { list } = await setup({ skipJob, listJobs: async (f) => (await api.listJobs(f)) });
    await userEvent.click(within(row(list, ORBITAL)).getByRole('button', { name: 'Skip' }));
    // A second skip saves the first one at once.
    await userEvent.click(within(row(list, FERNWOOD)).getByRole('button', { name: 'Skip' }));
    expect(skipJob).toHaveBeenCalledWith('j5');
    expect(within(list).queryByText(ORBITAL)).not.toBeInTheDocument();
  });

  it('brings a row back when its skip fails, saying so', async () => {
    const { list } = await setup({ skipJob: async () => { throw new Error('database is locked'); } });
    await userEvent.click(within(row(list, ORBITAL)).getByRole('button', { name: 'Skip' }));
    await userEvent.click(within(row(list, FERNWOOD)).getByRole('button', { name: 'Skip' }));
    expect(await within(list).findByText(ORBITAL)).toBeInTheDocument();
    expect(await screen.findByText(/Couldn't skip the job/)).toBeInTheDocument();
  });

  it('leaves out jobs Claude has open questions for: they belong to the Inbox', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const asking = { ...api, listQuestions: async () => [{ jobId: 'j5', questions: ['Can you start in two weeks?'], askedAt: '2026-11-07T08:00:00.000Z' }] };
    renderWithApp(<MatchesPage />, asking);
    const list = await screen.findByRole('region', { name: 'Match list' });
    await within(list).findByText(FERNWOOD);
    expect(within(list).queryByText(ORBITAL)).not.toBeInTheDocument();
  });

  /** A mock where Orbital (j5) was skipped before the page opened, so it sits in the Trash. */
  async function withTrash(over: Partial<ReturnType<typeof createMockApi>> = {}) {
    const api = createMockApi({ latencyMs: 0 });
    await api.skipJob('j5');
    renderWithApp(<MatchesPage />, { ...api, ...over });
    const list = await screen.findByRole('region', { name: 'Match list' });
    await within(list).findByText(FERNWOOD);
    return { api, list };
  }

  it('keeps skipped jobs out of All and lists them under the Trash, with their count', async () => {
    const { list } = await withTrash();
    expect(within(list).queryByText(ORBITAL)).not.toBeInTheDocument();
    // The mock already has one skipped job (Bergmann), so Orbital makes two.
    expect(screen.getByRole('button', { name: /^Trash/ })).toHaveTextContent('2');
    await userEvent.click(screen.getByRole('button', { name: /^Trash/ }));
    expect(within(list).getByText(ORBITAL)).toBeInTheDocument();
    expect(within(list).getByText('Backend Engineer (Java)')).toBeInTheDocument();
    expect(within(list).queryByText(FERNWOOD)).not.toBeInTheDocument();
    expect(row(list, ORBITAL)).toHaveTextContent('In the Trash.');
    expect(within(row(list, ORBITAL)).queryByRole('button', { name: /Draft|Score|Skip/ })).not.toBeInTheDocument();
  });

  it('restores a trashed job, which leaves the Trash and returns to its tab', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.skipJob('j5');
    const restore = vi.fn(api.restoreJob);
    renderWithApp(<MatchesPage />, { ...api, restoreJob: restore });
    const list = await screen.findByRole('region', { name: 'Match list' });
    await userEvent.click(await screen.findByRole('button', { name: /^Trash/ }));
    await userEvent.click(within(row(list, ORBITAL)).getByRole('button', { name: 'Restore' }));
    expect(restore).toHaveBeenCalledWith('j5');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Trash/ })).toHaveTextContent('1'));
    await userEvent.click(screen.getByRole('button', { name: /^All/ }));
    expect(within(list).getByText(ORBITAL)).toBeInTheDocument();
  });

  it('restores a selection from the Trash', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.skipJob('j5');
    await api.skipJob('j6');
    const restore = vi.fn(api.restoreJob);
    renderWithApp(<MatchesPage />, { ...api, restoreJob: restore });
    const list = await screen.findByRole('region', { name: 'Match list' });
    await userEvent.click(await screen.findByRole('button', { name: /^Trash/ }));
    await userEvent.click(within(row(list, ORBITAL)).getByRole('checkbox'));
    await userEvent.click(within(row(list, FERNWOOD)).getByRole('checkbox'));
    const selected = screen.getByRole('region', { name: 'Selected' });
    expect(within(selected).queryByRole('button', { name: /Draft|Score|Skip/ })).not.toBeInTheDocument();
    await userEvent.click(within(selected).getByRole('button', { name: 'Restore 2' }));
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it('puts a skip in the Trash once it is saved', async () => {
    const { list } = await setup();
    await userEvent.click(within(row(list, ORBITAL)).getByRole('button', { name: 'Skip' }));
    // A second skip saves the first at once.
    await userEvent.click(within(row(list, FERNWOOD)).getByRole('button', { name: 'Skip' }));
    await userEvent.click(screen.getByRole('button', { name: /^Trash/ }));
    expect(await within(list).findByText(ORBITAL)).toBeInTheDocument();
  });

  it('says the Trash is empty, not that filters hide things', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveSettings({ draftThreshold: 60 });
    const noTrash = { ...api, listJobs: async (f?: Parameters<typeof api.listJobs>[0]) => (await api.listJobs(f)).filter((j) => j.status !== 'skipped') };
    renderWithApp(<MatchesPage />, noTrash);
    const list = await screen.findByRole('region', { name: 'Match list' });
    await within(list).findByText(ORBITAL);
    await userEvent.click(screen.getByRole('button', { name: /^Trash/ }));
    expect(within(list).getByText('The Trash is empty')).toBeInTheDocument();
    expect(within(list).getByText(/Jobs you skip or clean up wait here until you restore them/)).toBeInTheDocument();
  });

  describe('Clean up', () => {
    const DAY = 86_400_000;
    afterEach(() => vi.useRealTimers());
    /** Orbital (67) and Fernwood (not scored) with the draft bar at `bar`; `daysLater` moves the clock so the jobs have aged. */
    async function cleanSetup({ bar = 60, daysLater = 0, over = {} as Partial<ReturnType<typeof createMockApi>> } = {}) {
      const api = createMockApi({ latencyMs: 0 });
      await api.saveSettings({ draftThreshold: bar });
      if (daysLater) vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + daysLater * DAY });
      renderWithApp(<MatchesPage />, { ...api, ...over });
      const list = await screen.findByRole('region', { name: 'Match list' });
      await within(list).findByText(FERNWOOD);
      return { api, list };
    }
    const openPanel = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Clean up' }));
      return screen.getByRole('region', { name: 'Clean up' });
    };

    it('opens with a count for each rule', async () => {
      await cleanSetup({ bar: 70 });
      const panel = await openPanel();
      expect(within(panel).getByText(/Matches older than/).closest('label')).toHaveTextContent('0');
      expect(within(panel).getByText('Matches below the draft bar (70)').closest('label')).toHaveTextContent('1');
    });

    it('previews what would move, and disables the button when nothing would', async () => {
      await cleanSetup({ bar: 70 });
      const panel = await openPanel();
      expect(within(panel).getByText(ORBITAL)).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Move 1 to the Trash' })).toBeEnabled();
      await userEvent.click(within(panel).getByRole('checkbox', { name: /below the draft bar/ }));
      expect(within(panel).getByRole('button', { name: 'Move 0 to the Trash' })).toBeDisabled();
      expect(within(panel).getByText('Nothing matches these rules.')).toBeInTheDocument();
    });

    it("refuses a days value that isn't a whole number from 1 to 365", async () => {
      await cleanSetup();
      const panel = await openPanel();
      const days = within(panel).getByRole('spinbutton', { name: 'Days' });
      await userEvent.clear(days);
      await userEvent.type(days, '0');
      expect(within(panel).getByText('Enter a whole number of days from 1 to 365.')).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: /Move .* to the Trash/ })).toBeDisabled();
    });

    it('moves the previewed jobs to the Trash, then undoes it', async () => {
      const base = createMockApi({ latencyMs: 0 });
      const skipJob = vi.fn(base.skipJob);
      const restoreJob = vi.fn(base.restoreJob);
      const { list } = await cleanSetup({ bar: 70, over: { skipJob, restoreJob } });
      const panel = await openPanel();
      await userEvent.click(within(panel).getByRole('button', { name: 'Move 1 to the Trash' }));
      expect(skipJob).toHaveBeenCalledWith('j5');
      const undo = await screen.findByRole('status', { name: 'Undo' });
      expect(undo).toHaveTextContent('Moved 1 match to the Trash.');
      expect(screen.queryByRole('region', { name: 'Clean up' })).not.toBeInTheDocument();
      expect(within(list).queryByText(ORBITAL)).not.toBeInTheDocument();
      await userEvent.click(within(undo).getByRole('button', { name: 'Undo' }));
      expect(restoreJob).toHaveBeenCalledWith('j5');
      expect(await within(list).findByText(ORBITAL)).toBeInTheDocument();
    });

    it('counts age from when a job was first seen, and lists what it would move', async () => {
      await cleanSetup({ daysLater: 20 });
      const panel = await openPanel();
      expect(within(panel).getByText(/Matches older than/).closest('label')).toHaveTextContent('2');
      expect(within(panel).getByText(ORBITAL)).toBeInTheDocument();
      expect(within(panel).getByText(FERNWOOD)).toBeInTheDocument();
    });

    it('keeps a job a match when its move fails, and moves the rest', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const base = createMockApi({ latencyMs: 0 });
      const skipJob = vi.fn(async (id: string) => { if (id === 'j5') throw new Error('database is locked'); return base.skipJob(id); });
      const { list } = await cleanSetup({ daysLater: 20, over: { skipJob } });
      const panel = await openPanel();
      await userEvent.click(within(panel).getByRole('button', { name: 'Move 2 to the Trash' }));
      expect(await screen.findByText(/Couldn't skip the job/)).toBeInTheDocument();
      expect(await screen.findByRole('status', { name: 'Undo' })).toHaveTextContent('Moved 1 match to the Trash.');
      expect(within(list).getByText(ORBITAL)).toBeInTheDocument();
      expect(within(list).queryByText(FERNWOOD)).not.toBeInTheDocument();
    });

    it('collapses Trash older than 30 days behind Show older, still counting it', async () => {
      await cleanSetup({ daysLater: 40 });
      await userEvent.click(screen.getByRole('button', { name: /^Trash/ }));
      expect(screen.getByRole('button', { name: /^Trash/ })).toHaveTextContent('1');
      expect(screen.getByText(/Nothing recent in the Trash/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Show older (1)' }));
      expect(await screen.findByText('Backend Engineer (Java)')).toBeInTheDocument();
    });
  });

  it('clears filters from an empty search', async () => {
    const { list } = await setup();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search matches' }), 'zzz');
    expect(screen.getByText('No matches fit your filters')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));
    expect(within(list).getByText(ORBITAL)).toBeInTheDocument();
  });

  it('opens on new matches from a scan\'s link', async () => {
    const api = createMockApi({ latencyMs: 0 });
    renderWithApp(<MatchesPage params={{ view: 'new' }} />, api);
    expect(await screen.findByRole('checkbox', { name: 'New since last scan' })).toBeChecked();
  });

  it('follows the link: /matches/new filters to new, then plain /matches shows everything again', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const view = renderWithApp(<MatchesPage params={{ view: 'new' }} />, api);
    expect(await screen.findByRole('checkbox', { name: 'New since last scan' })).toBeChecked();
    view.rerender(<ApiProvider api={api}><ToastProvider><MatchesPage params={{}} /></ToastProvider></ApiProvider>);
    expect(await screen.findByRole('checkbox', { name: 'New since last scan' })).not.toBeChecked();
  });

  it('says no matches yet, pointing to Get jobs', async () => {
    const api = createMockApi({ latencyMs: 0 });
    renderWithApp(<MatchesPage />, { ...api, listJobs: async () => [] });
    expect(await screen.findByText('No matches yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get jobs' })).toHaveAttribute('href', '#/get-jobs');
  });
});
