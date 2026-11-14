import { act, screen, within } from '@testing-library/react';
import type { AppStatus } from '../../../shared/types';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import DashboardPage from './dashboard-page';

const base = () => createMockApi({ latencyMs: 0 });

describe('DashboardPage', () => {
  it('greets with the date and status chip, and links Get jobs', async () => {
    renderWithApp(<DashboardPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'My job hunt' })).toBeInTheDocument();
    expect(screen.getAllByText(/Nothing running|Scanning|Drafting/).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Get jobs' })).toHaveAttribute('href', '#/get-jobs');
  });

  it('lists the four needs with the Inbox tab counts and opens the Inbox', async () => {
    const api = base();
    const questions = await api.listQuestions();
    renderWithApp(<DashboardPage />, api);
    const section = (await screen.findByRole('heading', { name: 'Needs you' })).closest('section')!;
    for (const label of ['Fix first', 'Answer', 'Approve', 'Hand off']) expect(within(section).getByText(label)).toBeInTheDocument();
    const answer = within(section).getByText('Answer').closest('a')!;
    expect(answer).toHaveTextContent(String(questions.length));
    expect(within(section).getByRole('link', { name: /Open Inbox/ })).toHaveAttribute('href', '#/inbox');
  });

  it('says nothing needs you when all are zero', async () => {
    const api = base();
    renderWithApp(<DashboardPage />, { ...api, listQuestions: async () => [], listJobs: async () => (await api.listJobs()).filter((j) => j.status !== 'drafted' && j.status !== 'approved') });
    expect(await screen.findByText('Nothing needs you right now.')).toBeInTheDocument();
  });

  it('shows the weekly goal from settings', async () => {
    const api = base();
    renderWithApp(<DashboardPage />, { ...api, getSettings: async () => ({ ...(await api.getSettings()), weeklyGoal: 7 }) });
    const card = (await screen.findByRole('heading', { name: 'Sent this week' })).closest('section')!;
    expect(card).toHaveTextContent('/ 7 goal');
  });

  it('says AI is stopped when the budget is used', async () => {
    const api = base();
    renderWithApp(<DashboardPage />, { ...api, getStatus: async () => ({ ...(await api.getStatus()), budgetStop: 'Daily budget used', tokensToday: 150_000, dailyTokenBudget: 150_000 }) });
    const card = (await screen.findByRole('heading', { name: 'AI budget today' })).closest('section')!;
    expect(card).toHaveTextContent('AI is paused: Daily budget used');
    expect(within(card).getByRole('link', { name: 'Raise budget' })).toHaveAttribute('href', '#/settings/guard');
  });

  it('names each bar and switches range', async () => {
    renderWithApp(<DashboardPage />);
    const chart = (await screen.findByRole('heading', { name: 'Applications sent' })).closest('section')!;
    expect(within(chart).getAllByRole('button', { name: /: \d+ sent, \d+ by Applio, \d+ by you/ })).toHaveLength(10);
    await userEvent.selectOptions(within(chart).getByLabelText('Range'), 'week');
    expect(within(chart).getAllByRole('button', { name: /: \d+ sent/ })).toHaveLength(8);
  });

  it('shows None for a zero', async () => {
    const api = base();
    renderWithApp(<DashboardPage />, { ...api, listJobs: async (f) => (await api.listJobs(f)).filter((j) => j.status !== 'replied') });
    const tile = (await screen.findByRole('heading', { name: 'Up next' })).closest('section')!;
    expect(within(tile).getByText('No replies')).toBeInTheDocument();
  });

  it('shows the pipeline for this month or all time', async () => {
    renderWithApp(<DashboardPage />);
    const pipe = (await screen.findByRole('heading', { name: 'Pipeline' })).closest('section')!;
    expect(within(pipe).getByText('Found')).toBeInTheDocument();
    await userEvent.click(within(pipe).getByRole('button', { name: 'This month' }));
    expect(within(pipe).getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a first-use state with no jobs', async () => {
    const api = base();
    renderWithApp(<DashboardPage />, { ...api, listJobs: async () => [], listQuestions: async () => [] });
    expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Get jobs' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Pipeline' })).not.toBeInTheDocument();
  });

  it('shows Retry when loading fails', async () => {
    const api = base();
    renderWithApp(<DashboardPage />, { ...api, listJobs: async () => { throw new Error('down'); } });
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('makes no mutating API call', async () => {
    const api = base();
    const mutating = ['draftJob', 'scoreJob', 'approveDraft', 'skipJob', 'markApplied', 'runDiscovery', 'saveSettings', 'sendFollowUp', 'setStatus'] as const;
    const spies = mutating.map((m) => vi.spyOn(api, m));
    renderWithApp(<DashboardPage />, api);
    await screen.findByRole('heading', { name: 'My job hunt' });
    await screen.findByRole('heading', { name: 'Pipeline' });
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it('counts Answer only for scored jobs that are not drafting, like the Inbox tab', async () => {
    const api = base();
    const jobs = await api.listJobs();
    const scored = jobs.find((j) => j.status === 'scored')!;
    const other = jobs.find((j) => j.status === 'drafted')!;
    renderWithApp(<DashboardPage />, {
      ...api,
      listQuestions: async () => [{ jobId: scored.id, questions: ['q'], askedAt: '' }, { jobId: other.id, questions: ['q'], askedAt: '' }],
    });
    const section = (await screen.findByRole('heading', { name: 'Needs you' })).closest('section')!;
    expect(within(section).getByText('Answer').closest('a')).toHaveTextContent('1');
  });

  it('updates the budget card when main pushes a status', async () => {
    const listeners = new Set<(s: AppStatus) => void>();
    window.applioEvents = { onStatus: (l) => { listeners.add(l); return () => listeners.delete(l); } };
    const api = base();
    renderWithApp(<DashboardPage />, api);
    const card = (await screen.findByRole('heading', { name: 'AI budget today' })).closest('section')!;
    const current = await api.getStatus();
    act(() => listeners.forEach((l) => l({ ...current, tokensToday: 150_000, dailyTokenBudget: 150_000, budgetStop: 'Monthly budget used' })));
    expect(await within(card).findByText(/AI is paused: Monthly budget used/)).toBeInTheDocument();
    delete window.applioEvents;
  });
});
