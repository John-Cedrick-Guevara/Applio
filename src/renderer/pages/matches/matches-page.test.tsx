import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
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

  it('says an unscored job waits for a scan', async () => {
    const { list } = await setup();
    expect(row(list, FERNWOOD)).toHaveTextContent('Not scored yet. Your next scan scores it.');
    expect(within(row(list, FERNWOOD)).queryByRole('button', { name: /Draft/ })).not.toBeInTheDocument();
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

  it('says no matches yet, pointing to Get jobs', async () => {
    const api = createMockApi({ latencyMs: 0 });
    renderWithApp(<MatchesPage />, { ...api, listJobs: async () => [] });
    expect(await screen.findByText('No matches yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get jobs' })).toHaveAttribute('href', '#/get-jobs');
  });
});
