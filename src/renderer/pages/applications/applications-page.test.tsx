import { screen, within } from '@testing-library/react';
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

  it('drafts and sends a follow-up when one is due', async () => {
    const { api } = renderWithApp(<ApplicationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Tessellate/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Draft follow-up' }));
    expect((screen.getByLabelText('Follow-up to Tessellate') as HTMLTextAreaElement).value).toContain('Following up on my application');
    await userEvent.type(screen.getByLabelText('Follow-up to Tessellate'), ' Thanks!');
    expect((await api.getJob('j10')).history.at(-1)?.note).toBeUndefined();
    await userEvent.click(screen.getByRole('button', { name: 'Send follow-up' }));
    expect((await screen.findAllByText(/Follow-up sent/)).length).toBeGreaterThan(0);
    expect((await api.getJob('j10')).history.at(-1)?.note).toBe('Follow-up sent');
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
});
