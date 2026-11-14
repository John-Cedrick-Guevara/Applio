import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStatus } from '../../../shared/types';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import ApplicationsPage from './applications-page';

const table = () => screen.findByRole('table');

describe('ApplicationsPage', () => {
  afterEach(() => {
    delete window.applioEvents;
  });

  it('reloads when main reports a job changed in the background, like a reply moving it to Interview', async () => {
    let push: (s: AppStatus) => void = () => {};
    window.applioEvents = { onStatus: (l) => ((push = l), () => {}) };
    const api = createMockApi({ latencyMs: 0 });
    renderWithApp(<ApplicationsPage />, api);
    const t = await table();
    const quanta = (await api.listJobs()).find((j) => j.company === 'Quanta Robotics')!;
    expect(within(t).getByText('Quanta Robotics').closest('tr')).not.toHaveTextContent('Interview');
    await api.setStatus(quanta.id, 'interview');
    const status = await api.getStatus();
    act(() => push({ ...status, jobsVersion: 1 }));
    act(() => push({ ...status, jobsVersion: 2 }));
    const row = () => within(t).getByText('Quanta Robotics').closest('tr')!;
    await vi.waitFor(() => expect(row()).toHaveTextContent('Interview'));
  });

  it('lists only applications that were sent', async () => {
    renderWithApp(<ApplicationsPage />);
    const t = await table();
    expect(within(t).getByText('Quanta Robotics')).toBeInTheDocument();
    expect(within(t).queryByText('Northwind Labs')).not.toBeInTheDocument();
  });

  it('filters by status group and search', async () => {
    renderWithApp(<ApplicationsPage />);
    const t = await table();
    await userEvent.click(screen.getByRole('button', { name: /^Closed/ }));
    expect(within(t).getByText('Brightwave')).toBeInTheDocument();
    expect(within(t).queryByText('Quanta Robotics')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search applications' }), 'zzz');
    expect(screen.getByText('No applications match')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(t).getByText('Quanta Robotics')).toBeInTheDocument();
  });

  it('shows the timeline and what was sent for the selected application', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Corvid Health/ }));
    const detail = screen.getByRole('complementary', { name: 'Application detail' });
    expect(within(detail).getByRole('heading', { name: 'Backend Engineer, Integrations' })).toBeInTheDocument();
    expect(within(detail).getByText('Found on Lever watchlist')).toBeInTheDocument();
    expect(await within(detail).findByText('resume.pdf')).toBeInTheDocument();
  });

  it('shows the subject and recipient exactly as the send log stored them, even after the draft is edited', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const send = await api.getSend('j10');
    await api.updateCoverLetter('j10', 'Edited after sending');
    renderWithApp(<ApplicationsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    const detail = screen.getByRole('complementary', { name: 'Application detail' });
    expect(await within(detail).findByText(send!.state === 'sent' ? send!.subject : '')).toBeInTheDocument();
    expect(within(detail).getByText('jobs@tessellate.example')).toBeInTheDocument();
    expect(within(detail).queryByText(/Edited after sending/)).not.toBeInTheDocument();
  });

  it('opens the sent résumé from its file chip', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const open = vi.spyOn(api, 'openDraftFile');
    renderWithApp(<ApplicationsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'resume.pdf' }));
    expect(open).toHaveBeenCalledWith('j10', 'resume');
  });

  it('says an application made outside Applio has no send record, rather than inventing one', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.markApplied('j3');
    renderWithApp(<ApplicationsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: /Ledgerly/ }));
    const detail = screen.getByRole('complementary', { name: 'Application detail' });
    expect(await within(detail).findByText(/You applied to this one yourself, outside Applio/)).toBeInTheDocument();
  });

  it("credits the job's board with its own name and a link back", async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Paperplane/ }));
    const detail = screen.getByRole('complementary', { name: 'Application detail' });
    expect(within(detail).getByRole('link', { name: 'Remote OK' })).toHaveAttribute('href', 'https://example.com/jobs/j8');
  });

  it('generates interview prep for replies and interviews', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Corvid Health/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Interview prep' }));
    expect(await screen.findByText('Likely questions')).toBeInTheDocument();
  });

  it('drafts and sends a follow-up when one is due, signed with the real name', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveSettings({ fullName: 'Sam Rivera' });
    renderWithApp(<ApplicationsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Draft follow-up' }));
    const box = screen.getByLabelText('Follow-up to Tessellate') as HTMLTextAreaElement;
    expect(box.value).toContain('Following up on my application');
    expect(box.value).toMatch(/Best,\nSam Rivera$/);
    await userEvent.type(screen.getByLabelText('Follow-up to Tessellate'), ' Thanks!');
    expect((await api.getJob('j10')).history.at(-1)?.note).toBeUndefined();
    await userEvent.click(screen.getByRole('button', { name: 'Send follow-up' }));
    expect((await screen.findAllByText(/Follow-up sent/)).length).toBeGreaterThan(0);
    expect((await api.getJob('j10')).history.at(-1)?.note).toBe('Follow-up sent');
  });

  it('keeps Send follow-up disabled while a placeholder remains, and says why', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveSettings({ fullName: 'Sam Rivera' });
    renderWithApp(<ApplicationsPage />, api);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Draft follow-up' }));
    await userEvent.type(screen.getByLabelText('Follow-up to Tessellate'), ' [[Company]');
    expect(screen.getByRole('button', { name: 'Send follow-up' })).toBeDisabled();
    expect(screen.getByText('Replace [Company] before sending.')).toBeInTheDocument();
  });

  it('asks for a name in Settings before a follow-up can be signed and sent', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Draft follow-up' }));
    expect(screen.getByRole('button', { name: 'Send follow-up' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '#/settings');
  });

  it('lets the operator correct a status, offering only the moves the rules allow', async () => {
    const { api } = renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Quanta Robotics/ }));
    const detail = screen.getByRole('complementary', { name: 'Application detail' });
    const menu = within(detail).getByLabelText('Correct status');
    expect(within(menu).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose…', 'Replied', 'Interview', 'Rejected', 'No reply']);
    await userEvent.selectOptions(menu, 'Interview');
    expect((await api.getJob('j7')).status).toBe('interview');
  });

  it('says there are no applications yet, rather than that a filter hid them', async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'listJobs').mockResolvedValue([]);
    renderWithApp(<ApplicationsPage />, api);
    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows the list full width with no application open', async () => {
    renderWithApp(<ApplicationsPage />);
    await table();
    expect(screen.getByRole('heading', { level: 1, name: 'My applications' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Application detail' })).not.toBeInTheDocument();
  });

  it('opens an application in the side panel, from the whole row, with its position', async () => {
    renderWithApp(<ApplicationsPage />);
    const t = await table();
    await userEvent.click(within(t).getByText('Corvid Health').closest('tr')!);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('complementary', { name: 'Application detail' })).toBeInTheDocument();
    expect(within(dialog).getByText(/^\d+ of \d+$/)).toBeInTheDocument();
  });

  it('steps to the next application in the filtered list', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Corvid Health/ }));
    const dialog = screen.getByRole('dialog');
    const before = within(dialog).getByRole('complementary', { name: 'Application detail' }).textContent;
    const index = Number(within(dialog).getByText(/^\d+ of \d+$/).textContent!.split(' ')[0]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByRole('complementary', { name: 'Application detail' }).textContent).not.toBe(before);
    expect(within(dialog).getByText(new RegExp(`^${index + 1} of \\d+$`))).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the row', async () => {
    renderWithApp(<ApplicationsPage />);
    const row = await screen.findByRole('button', { name: /Corvid Health/ });
    await userEvent.click(row);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it('shows the four stats as cards', async () => {
    renderWithApp(<ApplicationsPage />);
    await table();
    for (const label of ['Sent this month', 'Replies, incl. interviews', 'Interviews', 'Follow-ups due']) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('returns focus to the row after opening from a non-button cell', async () => {
    renderWithApp(<ApplicationsPage />);
    const t = await table();
    const row = within(t).getByText('Corvid Health').closest('tr')!;
    await userEvent.click(within(row).getAllByRole('cell')[3]!);
    await userEvent.keyboard('{Escape}');
    expect(within(row).getByRole('button')).toHaveFocus();
  });

  it('returns focus to the application shown when it closes, after stepping', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Quanta Robotics/ }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Next' }));
    const shown = screen.getByRole('dialog').querySelector('.app-detail-title')!.textContent!;
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement?.textContent).toContain(shown);
  });

  it('keeps an edit when Next is pressed: it focuses the editor instead of stepping', async () => {
    renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Draft follow-up' }));
    const position = within(dialog).getByText(/^\d+ of \d+$/).textContent;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    expect(within(dialog).getByText(position!)).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox')).toHaveFocus();
  });

  it('does not open the panel when a click ends a text selection', async () => {
    renderWithApp(<ApplicationsPage />);
    const t = await table();
    const cell = within(t).getByText('Corvid Health');
    const range = document.createRange();
    range.selectNodeContents(cell);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    // fireEvent: a real mouse-up after a drag fires click without a fresh mousedown clearing the selection.
    fireEvent.click(cell.closest('tr')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    window.getSelection()!.removeAllRanges();
  });
});
