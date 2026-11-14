import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import { App } from '../../app';

const BACKEND = 'Senior Backend Engineer';

afterEach(() => {
  window.location.hash = '';
});

const withGmail = async (api = createMockApi({ latencyMs: 0 })) => {
  await api.saveSettings({ gmailAddress: 'sam@gmail.com', fullName: 'Sam Rivera' });
  await api.setSecret('gmailAppPassword', 'abcd efgh ijkl mnop');
  return api;
};

/** The whole app at an Inbox job, so navigation between jobs is real. */
async function inboxAt(id: string, api = createMockApi({ latencyMs: 0 })) {
  window.location.hash = `#/inbox/${id}`;
  const view = renderWithApp(<App />, api);
  await screen.findByRole('region', { name: 'Draft detail' });
  const queue = await screen.findByRole('region', { name: 'Queue' });
  return { ...view, queue, panel: () => within(queue).getByRole('tabpanel') };
}

describe('Inbox flow', () => {
  it('skips with undo instead of a confirm, opening the next job', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const skipJob = vi.fn(api.skipJob);
    const { panel } = await inboxAt('j1', { ...api, skipJob });
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#/inbox/j2'));
    expect(within(panel()).queryByText(BACKEND)).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Undo' })).toHaveTextContent(`Skipped ${BACKEND} at Northwind Labs.`);
    expect(skipJob).not.toHaveBeenCalled();
  });

  it('brings a skipped job back on undo, and opens it', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const skipJob = vi.fn(api.skipJob);
    const { panel } = await inboxAt('j1', { ...api, skipJob });
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    await userEvent.click(within(screen.getByRole('status', { name: 'Undo' })).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(window.location.hash).toBe('#/inbox/j1'));
    expect(within(panel()).getByText(BACKEND)).toBeInTheDocument();
    expect(skipJob).not.toHaveBeenCalled();
  });

  it('saves a held skip when the Inbox closes', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const skipJob = vi.fn(api.skipJob);
    const { unmount } = await inboxAt('j1', { ...api, skipJob });
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    unmount();
    expect(skipJob).toHaveBeenCalledWith('j1');
  });

  it('brings a job back when its skip fails, saying so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = createMockApi({ latencyMs: 0 });
    const { queue } = await inboxAt('j1', { ...api, skipJob: async () => { throw new Error('database is locked'); } });
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    await waitFor(() => expect(window.location.hash).toBe('#/inbox/j2'));
    // Skipping the next job saves the first skip at once.
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    expect(await screen.findByText(/Couldn't skip the job/)).toBeInTheDocument();
    // The first job is back in Approve; the second is still held.
    await waitFor(() => expect(within(queue).getByRole('tab', { name: /Approve/ })).toHaveTextContent('1'));
    await userEvent.click(within(queue).getByRole('tab', { name: /Approve/ }));
    expect(within(within(queue).getByRole('tabpanel')).getByText(BACKEND)).toBeInTheDocument();
  });

  it('opens the next job after a send that went out, saying where it went, with no undo', async () => {
    const api = await withGmail();
    await inboxAt('j1', api);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve & send email' }));
    await waitFor(() => expect(window.location.hash).toBe('#/inbox/j2'));
    const message = await screen.findByText(/^Sent to jobs@northwind-labs.example/);
    expect(message.closest('[role="status"], .toast')?.textContent ?? '').not.toMatch(/Undo/);
    expect(await api.getSend('j1')).toMatchObject({ state: 'sent' });
  });

  it('stays on the sent job when Open the next job is off', async () => {
    const api = await withGmail();
    await inboxAt('j1', api);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Open the next job after I decide' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Approve & send email' }));
    expect(await screen.findByText(/Sent to jobs@northwind-labs.example/)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/inbox/j1');
  });

  it('moves on after Mark as applied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const api = createMockApi({ latencyMs: 0, sendFailure: () => 'The form needs a CAPTCHA.' });
    await inboxAt('j2', api);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve & submit form' }));
    await userEvent.click(await screen.findByRole('button', { name: 'I finished it myself' }));
    await waitFor(() => expect(window.location.hash).not.toBe('#/inbox/j2'));
    expect(await screen.findByText('Marked as applied.')).toBeInTheDocument();
  });

  it('approves with A in the panel, through the same button', async () => {
    const api = await withGmail();
    await inboxAt('j1', api);
    // The draft loads inside the detail region; A needs its Approve button to exist.
    await screen.findByRole('button', { name: 'Approve & send email' });
    screen.getByRole('button', { name: 'Close' }).focus();
    await userEvent.keyboard('a');
    await waitFor(async () => expect(await api.getSend('j1')).toMatchObject({ state: 'sent' }));
  });

  it('does nothing on A while Approve is disabled', async () => {
    const { api } = await inboxAt('j1');
    await screen.findByRole('link', { name: 'Set up Gmail to send' });
    screen.getByRole('button', { name: 'Close' }).focus();
    await userEvent.keyboard('a');
    expect(await api.getSend('j1')).toBeNull();
  });

  it('asks for the second confirm when A approves a suspicious post', async () => {
    const api = await withGmail();
    const flagged: typeof api = { ...api, getJob: async (id) => ({ ...(await api.getJob(id)), suspicious: 'The post addresses AI tools directly.' }) };
    await inboxAt('j1', flagged);
    await screen.findByRole('button', { name: 'Approve & send email' });
    screen.getByRole('button', { name: 'Close' }).focus();
    await userEvent.keyboard('a');
    expect(await screen.findByRole('button', { name: 'Send anyway' })).toBeInTheDocument();
    expect(await api.getSend('j1')).toBeNull();
  });

  it('skips with S in the panel', async () => {
    await inboxAt('j1');
    await screen.findByRole('button', { name: 'Skip job' });
    screen.getByRole('button', { name: 'Close' }).focus();
    await userEvent.keyboard('s');
    expect(await screen.findByRole('status', { name: 'Undo' })).toHaveTextContent(`Skipped ${BACKEND}`);
  });

  it('ignores A and S while typing in a field', async () => {
    const api = await withGmail();
    await inboxAt('j1', api);
    await screen.findByRole('button', { name: 'Approve & send email' });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.click(document.getElementById('letter-edit')!);
    await userEvent.keyboard('as');
    expect(await api.getSend('j1')).toBeNull();
    expect(screen.queryByRole('status', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('shows the position and steps to the next job in the tab', async () => {
    await inboxAt('j1');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 of 2')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(window.location.hash).toBe('#/inbox/j2'));
    expect(await within(dialog).findByText('2 of 2')).toBeInTheDocument();
  });

  it('closes to the list on Escape and returns focus to the row that opened it', async () => {
    window.location.hash = '#/inbox';
    renderWithApp(<App />);
    const row = (await screen.findAllByRole('link', { name: /Senior Backend Engineer/ }))[0]!;
    await userEvent.click(row);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/inbox');
    expect(row).toHaveFocus();
  });

  it('closes the panel when no job is left after a skip', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const others = (await api.listJobs({ statuses: ['drafted', 'approved'] })).filter((j) => j.id !== 'j1');
    for (const j of others) await api.skipJob(j.id);
    await inboxAt('j1', api);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip job' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/inbox');
  });
});
