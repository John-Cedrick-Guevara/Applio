import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import HandoffPage from './handoff-page';

const open = () => renderWithApp(<HandoffPage params={{ id: 'j3' }} />);

describe('HandoffPage', () => {
  it('walks through applying on the platform', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Apply to Ledgerly on LinkedIn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open on LinkedIn' })).toBeInTheDocument();
    expect(screen.getByText('How many years of experience do you have with Kubernetes?')).toBeInTheDocument();
  });

  it('numbers only the steps it shows, with no gap when there are no screening questions', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const noAnswers = { ...api, getDraft: async (id: string) => ({ ...(await api.getDraft(id))!, answers: [] }) };
    const { container } = renderWithApp(<HandoffPage params={{ id: 'j3' }} />, noAnswers);
    await screen.findByText('Upload your tailored resume');
    expect([...container.querySelectorAll('.step-num')].map((n) => n.textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('words the assisted-fill tip for a career-site job as career sites, not platforms', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const careerSite = { ...api, getJob: async (id: string) => ({ ...(await api.getJob(id)), channel: 'custom' as const, platform: undefined }) };
    renderWithApp(<HandoffPage params={{ id: 'j3' }} />, careerSite);
    expect(await screen.findByText(/Turn on assisted fill for company career sites/)).toBeInTheDocument();
  });

  it('copies an answer to the clipboard', async () => {
    const user = userEvent.setup();
    open();
    const buttons = await screen.findAllByRole('button', { name: /^Copy answer/ });
    await user.click(buttons[0]!);
    expect(await navigator.clipboard.readText()).toBe('4');
    expect(buttons[0]).toHaveTextContent('Copied');
  });

  it('logs the application once the operator is done', async () => {
    const { api } = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as applied' }));
    expect(await screen.findByText(/Logged as applied via LinkedIn Easy Apply/)).toBeInTheDocument();
    expect((await api.getJob('j3')).status).toBe('applied');
  });

  it('records when the operator decided not to apply', async () => {
    const { api } = open();
    await userEvent.click(await screen.findByRole('button', { name: "I didn't apply" }));
    expect(await screen.findByText(/Marked as not applied/)).toBeInTheDocument();
    expect((await api.getJob('j3')).status).toBe('skipped');
  });

  it('fills the form in Applio when assisted fill is on, and says what is left for the operator', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveSettings({ assistedFill: { platform: true, custom: false } });
    const assistFill = vi.spyOn(api, 'assistFill');
    renderWithApp(<HandoffPage params={{ id: 'j3' }} />, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Fill it in Applio' }));
    expect(assistFill).toHaveBeenCalledWith('j3');
    expect(await screen.findByText('Filled 6 fields. Check them in the window, then click Submit yourself.')).toBeInTheDocument();
    expect(screen.getByText('Current company')).toBeInTheDocument();
  });

  it('stays a manual handoff when assisted fill is off', async () => {
    renderWithApp(<HandoffPage params={{ id: 'j3' }} />);
    expect(await screen.findByText(/Assisted fill is off for/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fill it in Applio' })).not.toBeInTheDocument();
  });

  it('shows the Connects an Upwork proposal costs before the operator proceeds', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const job = await api.getJob('j3');
    vi.spyOn(api, 'getJob').mockResolvedValue({ ...job, platform: 'Upwork', description: 'Send a proposal for: 16 Connects' });
    renderWithApp(<HandoffPage params={{ id: 'j3' }} />, api);
    expect(await screen.findByText('This proposal costs 16 Connects on Upwork.')).toBeInTheDocument();
  });
});
