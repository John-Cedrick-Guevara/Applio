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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('checkbox', { name: 'Open the next job after each decision' }));
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

  it('approves with A from the list, through the same button', async () => {
    const api = await withGmail();
    const { panel } = await inboxAt('j1', api);
    within(panel()).getAllByRole('link')[0]!.focus();
    await userEvent.keyboard('a');
    await waitFor(async () => expect(await api.getSend('j1')).toMatchObject({ state: 'sent' }));
  });

  it('does nothing on A while Approve is disabled', async () => {
    const { panel, api } = await inboxAt('j1');
    within(panel()).getAllByRole('link')[0]!.focus();
    await userEvent.keyboard('a');
    expect(await api.getSend('j1')).toBeNull();
  });

  it('asks for the second confirm when A approves a suspicious post', async () => {
    const api = await withGmail();
    const flagged: typeof api = { ...api, getJob: async (id) => ({ ...(await api.getJob(id)), suspicious: 'The post addresses AI tools directly.' }) };
    const { panel } = await inboxAt('j1', flagged);
    within(panel()).getAllByRole('link')[0]!.focus();
    await userEvent.keyboard('a');
    expect(await screen.findByRole('button', { name: 'Send anyway' })).toBeInTheDocument();
    expect(await api.getSend('j1')).toBeNull();
  });

  it('skips with S from the list', async () => {
    const { panel } = await inboxAt('j1');
    within(panel()).getAllByRole('link')[0]!.focus();
    await userEvent.keyboard('s');
    expect(await screen.findByRole('status', { name: 'Undo' })).toHaveTextContent(`Skipped ${BACKEND}`);
  });
});
