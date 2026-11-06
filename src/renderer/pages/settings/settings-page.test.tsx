import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import SettingsPage from './settings-page';

describe('SettingsPage', () => {
  it('turns a source off and changes its autonomy', async () => {
    const { api } = renderWithApp(<SettingsPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Use Jobicy' }));
    expect((await api.listSources()).find((s) => s.id === 'jobicy')?.enabled).toBe(false);
    const group = screen.getByRole('group', { name: 'Autonomy for Remotive' });
    await userEvent.click(within(group).getByRole('button', { name: 'Autonomous' }));
    expect((await api.listSources()).find((s) => s.id === 'remotive')?.autonomy).toBe('autonomous');
  });

  it('never offers autonomous mode for clipped jobs', async () => {
    renderWithApp(<SettingsPage />);
    const group = await screen.findByRole('group', { name: 'Autonomy for Clipped jobs' });
    expect(within(group).getByRole('button', { name: 'Autonomous' })).toBeDisabled();
  });

  it('changes how often discovery runs and turns on launch at login', async () => {
    const { api } = renderWithApp(<SettingsPage />);
    await userEvent.selectOptions(await screen.findByLabelText('Run discovery every'), '4 hours');
    expect((await api.getSettings()).discoveryIntervalHours).toBe(4);
    await userEvent.click(screen.getByRole('switch', { name: 'Open Applio at login' }));
    expect((await api.getSettings()).launchAtLogin).toBe(true);
  });

  it('shows whether the AI engine is ready, and why not', async () => {
    renderWithApp(<SettingsPage />);
    const engine = await screen.findByRole('radiogroup', { name: 'AI engine' });
    expect(await screen.findByText('Ready', { selector: '.badge' })).toBeInTheDocument();
    await userEvent.click(within(engine).getByRole('radio', { name: 'API key' }));
    expect(await screen.findByText('Needs setup')).toBeInTheDocument();
    expect(screen.getByText('Add your Anthropic API key below.')).toBeInTheDocument();
  });

  it('saves the name printed on résumés and letters', async () => {
    const { api } = renderWithApp(<SettingsPage />);
    await userEvent.type(await screen.findByLabelText('Name on your documents'), 'Sam Rivera');
    await userEvent.tab();
    expect((await api.getSettings()).fullName).toBe('Sam Rivera');
  });

  it('switches platform apply to assisted fill', async () => {
    const { api } = renderWithApp(<SettingsPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Assisted fill for Platform apply' }));
    expect(await screen.findByText('Assisted fill')).toBeInTheDocument();
    expect((await api.getSettings()).assistedFill.platform).toBe(true);
  });

  it('validates guardrails and saves on blur', async () => {
    const { api } = renderWithApp(<SettingsPage />);
    const auto = await screen.findByLabelText('Auto-send at match score');
    await userEvent.clear(auto);
    await userEvent.type(auto, '60');
    await userEvent.tab();
    expect(screen.getByText(/at least the draft score/)).toBeInTheDocument();
    await userEvent.clear(auto);
    await userEvent.type(auto, '90');
    await userEvent.tab();
    await screen.findByText('Saved');
    expect((await api.getSettings()).autoSendThreshold).toBe(90);
  });

  it('adds and removes blocked companies', async () => {
    const { api } = renderWithApp(<SettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add company' }));
    await userEvent.type(screen.getByLabelText('Company to block'), 'Acme{Enter}');
    expect(await screen.findByRole('button', { name: 'Remove Acme' })).toBeInTheDocument();
    expect((await api.getSettings()).blocklist).toContain('Acme');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Acme' }));
    expect((await api.getSettings()).blocklist).not.toContain('Acme');
  });

  it('stores an API key in the keychain without showing it again', async () => {
    const { api } = renderWithApp(<SettingsPage />);
    await userEvent.click(await screen.findByRole('radio', { name: 'API key' }));
    expect(await screen.findByText('Needs setup')).toBeInTheDocument();
    const key = screen.getByLabelText('Anthropic API key');
    await userEvent.type(key, 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Save to keychain' }));
    expect(screen.getByText(/starts with sk-ant-/)).toBeInTheDocument();
    await userEvent.clear(key);
    await userEvent.type(key, 'sk-ant-test-123');
    await userEvent.click(screen.getByRole('button', { name: 'Save to keychain' }));
    expect(await screen.findByText(/saved to your system keychain/)).toBeInTheDocument();
    expect(key).toHaveValue('');
    expect(document.body.textContent).not.toContain('sk-ant-test-123');
    expect((await api.getSettings()).secretsSet.anthropicApiKey).toBe(true);
  });

  it('asks for Gmail credentials before testing the connection', async () => {
    renderWithApp(<SettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Send test email' }));
    expect(await screen.findByText(/Missing credentials/)).toBeInTheDocument();
  });

  it("shows the one-time sign-in command for Applio's Claude Code profile, ready to copy", async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'testConnection').mockResolvedValue({ ok: false, message: "Claude Code isn't signed in for Applio yet.", command: 'CLAUDE_CONFIG_DIR="/x/claude" claude auth login' });
    renderWithApp(<SettingsPage />, api);
    expect(await screen.findByText('CLAUDE_CONFIG_DIR="/x/claude" claude auth login')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
  });
});
