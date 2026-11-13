import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppStatus } from '../../../shared/types';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import AddJobPage from './add-job-page';

describe('AddJobPage', () => {
  afterEach(() => {
    delete window.applioEvents;
  });

  it('explains what is missing before analyzing', async () => {
    renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    expect(screen.getByText('Paste the job post first.')).toBeInTheDocument();
  });

  it('says what is happening while the post is read and scored', async () => {
    const api = createMockApi({ latencyMs: 0 });
    // Held open, as a real 20–40 second analysis would be.
    vi.spyOn(api, 'analyzeJob').mockReturnValue(new Promise(() => {}));
    renderWithApp(<AddJobPage />, api);
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    expect(screen.getByText(/Claude is reading and scoring the post/).closest('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Checking the match…' })).toHaveAttribute('aria-busy', 'true');
  });

  it('reads a pasted post, works out the channel and adds it to review', async () => {
    const { api } = renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    const result = await screen.findByRole('region', { name: 'Parsed job' });
    expect(result).toHaveTextContent('Senior TypeScript Engineer');
    expect(result).toHaveTextContent('Sends from your Gmail to hiring@brightline.example');
    expect(result).toHaveTextContent('Autonomous');
    expect((await api.listJobs()).some((j) => j.company === 'Brightline Studio')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Add and draft' }));
    const added = (await api.listJobs({ statuses: ['drafted'] })).find((j) => j.company === 'Brightline Studio')!;
    expect(await screen.findByRole('link', { name: 'Review and approve' })).toHaveAttribute('href', `#/inbox/${added.id}`);
    expect(within(screen.getByRole('list', { name: 'Steps' })).getByRole('listitem', { name: 'Ready: needs you' })).toBeInTheDocument();
  });

  it('keeps the pasted post when going back to edit it', async () => {
    renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    const post = (screen.getByLabelText('Job post') as HTMLTextAreaElement).value;
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Edit the post' }));
    expect(screen.getByLabelText('Job post')).toHaveValue(post);
    expect(screen.queryByRole('region', { name: 'Parsed job' })).not.toBeInTheDocument();
  });

  it('follows the draft on the page after adding, until it is ready', async () => {
    const api = createMockApi({ latencyMs: 0 });
    let ready = false;
    const live = { ...api, getJob: async (id: string) => (ready ? api.getJob(id) : { ...(await api.getJob(id)), status: 'scored' as const, folderPath: undefined }) };
    const listeners = new Set<(s: AppStatus) => void>();
    window.applioEvents = { onStatus: (l) => (listeners.add(l), () => listeners.delete(l)) };
    const push = async (over: Partial<AppStatus>) => {
      const status = { ...(await api.getStatus()), ...over };
      act(() => listeners.forEach((l) => l(status)));
    };
    renderWithApp(<AddJobPage />, live);
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add and draft' }));
    const id = (await api.listJobs()).find((j) => j.company === 'Brightline Studio')!.id;
    await push({ drafting: [id], draftingSince: { [id]: new Date(Date.now() - 30_000).toISOString() }, jobsVersion: 1 });
    const progress = await screen.findByRole('region', { name: 'Draft progress' });
    expect(progress).toHaveTextContent(/Claude is writing the résumé and letter/);
    expect(progress).toHaveTextContent(/0:[23]\d elapsed/);
    ready = true;
    await push({ drafting: [], draftingSince: {}, jobsVersion: 2 });
    expect(await within(progress).findByRole('link', { name: 'Review and approve' })).toHaveAttribute('href', `#/inbox/${id}`);
  });

  it('offers Open existing instead of an Add button bound to fail when the job is already in Applio', async () => {
    const { api } = renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add and draft' }));
    const added = (await api.listJobs()).find((j) => j.company === 'Brightline Studio')!;
    await userEvent.click(await screen.findByRole('button', { name: 'Add another job' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use an example' }));
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    const result = await screen.findByRole('region', { name: 'Parsed job' });
    expect(within(result).getByRole('status')).toHaveTextContent('You already have this job in Applio (Drafted).');
    expect(within(result).getByRole('link', { name: 'Open existing' })).toHaveAttribute('href', `#/inbox/${added.id}`);
    expect(within(result).queryByRole('button', { name: 'Add and draft' })).not.toBeInTheDocument();
  });

  it('disables Check the match with the reason once the daily token budget is used', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const spent = { ...api, getStatus: async () => ({ ...(await api.getStatus()), budgetStop: "Today's Claude token budget is used up." }) };
    renderWithApp(<AddJobPage />, spent);
    expect(await screen.findByText(/Today's Claude token budget is used up/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check the match' })).toBeDisabled();
  });

  it("states the paste's cost against today's budget", async () => {
    renderWithApp(<AddJobPage />);
    expect(await screen.findByText('Reading and scoring: ≈ 8k tokens · 12% of the 68k left today')).toBeInTheDocument();
    expect(screen.getByText('A post that names a job you already have is caught first, for free.')).toBeInTheDocument();
  });

  it('caps platform links at draft → approve', async () => {
    renderWithApp(<AddJobPage />);
    await userEvent.click(screen.getByRole('tab', { name: 'Paste link' }));
    await userEvent.type(screen.getByLabelText('Job link'), 'https://www.linkedin.com/jobs/view/1');
    await userEvent.click(screen.getByRole('button', { name: 'Check the match' }));
    const result = await screen.findByRole('region', { name: 'Parsed job' });
    expect(result).toHaveTextContent('Manual handoff (assisted fill is off)');
    expect(result).toHaveTextContent('Draft → Approve');
  });
});
