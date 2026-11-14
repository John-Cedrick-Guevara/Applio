import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMockApi } from '../../../shared/mock/mock-api';
import { renderWithApp } from '../../../test/render';
import { App } from '../../app';
import SettingsPage from './settings-page';

/** Switches to a settings tab once the page has loaded. */
const go = async (name: RegExp) => userEvent.click(await screen.findByRole('tab', { name }));

describe('SettingsPage', () => {
  it('turns a source off and changes its autonomy', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Use Jobicy' }));
    expect((await api.listSources()).find((s) => s.id === 'jobicy')?.enabled).toBe(false);
    // Settings save on change, so each change confirms itself.
    expect(await screen.findByText('Jobicy turned off')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Autonomy for Remotive' });
    await userEvent.click(within(group).getByRole('button', { name: 'Autonomous' }));
    expect((await api.listSources()).find((s) => s.id === 'remotive')?.autonomy).toBe('autonomous');
  });

  it('never offers autonomous mode for clipped jobs', async () => {
    renderWithApp(<SettingsPage params={{}} />);
    const group = await screen.findByRole('group', { name: 'Autonomy for Clipped jobs' });
    expect(within(group).getByRole('button', { name: 'Autonomous' })).toBeDisabled();
  });

  it('turns on launch at login, with no scan schedule to set', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await go(/^Files/);
    await userEvent.click(await screen.findByRole('switch', { name: 'Open Applio at login' }));
    expect(screen.queryByLabelText('Run discovery every')).not.toBeInTheDocument();
    expect((await api.getSettings()).launchAtLogin).toBe(true);
  });

  it('shows whether the AI engine is ready, and why not', async () => {
    renderWithApp(<SettingsPage params={{}} />);
    await go(/^Connections/);
    const engine = await screen.findByRole('radiogroup', { name: 'AI engine' });
    expect(await screen.findByText('Ready', { selector: '.badge' })).toBeInTheDocument();
    await userEvent.click(within(engine).getByRole('radio', { name: 'API key' }));
    expect(await screen.findByText('Needs setup')).toBeInTheDocument();
    expect(screen.getByText('Add your Anthropic API key below.')).toBeInTheDocument();
  });

  it('saves the name printed on résumés and letters', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await go(/^Files/);
    await userEvent.type(await screen.findByLabelText('Name on your documents'), 'Sam Rivera');
    await userEvent.tab();
    expect((await api.getSettings()).fullName).toBe('Sam Rivera');
  });

  it('switches platform apply to assisted fill', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await go(/^Channels/);
    await userEvent.click(await screen.findByRole('switch', { name: 'Assisted fill for Platform apply' }));
    expect(await screen.findByText('Assisted fill')).toBeInTheDocument();
    expect((await api.getSettings()).assistedFill.platform).toBe(true);
  });

  it('validates guardrails and saves on blur', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await go(/^Guardrails/);
    const auto = await screen.findByLabelText('Auto-send at (match score)');
    await userEvent.clear(auto);
    await userEvent.type(auto, '60');
    await userEvent.tab();
    expect(screen.getByText(/at least the draft bar/)).toBeInTheDocument();
    await userEvent.clear(auto);
    await userEvent.type(auto, '90');
    await userEvent.tab();
    await screen.findByText('Saved');
    expect((await api.getSettings()).autoSendThreshold).toBe(90);
  });

  it('adds and removes blocked companies', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await go(/^Guardrails/);
    await userEvent.click(await screen.findByRole('button', { name: 'Add company' }));
    await userEvent.type(screen.getByLabelText('Company to block'), 'Acme{Enter}');
    expect(await screen.findByRole('button', { name: 'Remove Acme' })).toBeInTheDocument();
    expect((await api.getSettings()).blocklist).toContain('Acme');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Acme' }));
    expect((await api.getSettings()).blocklist).not.toContain('Acme');
  });

  it('stores an API key in the keychain without showing it again', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await go(/^Connections/);
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
    renderWithApp(<SettingsPage params={{}} />);
    await go(/^Connections/);
    await userEvent.click(await screen.findByRole('button', { name: 'Send test email' }));
    expect(await screen.findByText(/Missing credentials/)).toBeInTheDocument();
  });

  it("shows the one-time sign-in command for Applio's Claude Code profile, ready to copy", async () => {
    const api = createMockApi({ latencyMs: 0 });
    vi.spyOn(api, 'testConnection').mockResolvedValue({ ok: false, message: "Claude Code isn't signed in for Applio yet.", command: 'CLAUDE_CONFIG_DIR="/x/claude" claude auth login' });
    renderWithApp(<SettingsPage params={{}} />, api);
    await go(/^Connections/);
    expect(await screen.findByText('CLAUDE_CONFIG_DIR="/x/claude" claude auth login')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy/ })).toBeInTheDocument();
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
  });

  it('never shows Connected for a Gmail password that was rejected, and says why', async () => {
    const api = createMockApi({ latencyMs: 0, signInFailure: () => 'Gmail rejected the address or app password.' });
    await api.saveSettings({ gmailAddress: 'sam@gmail.com' });
    renderWithApp(<SettingsPage params={{}} />, api);
    await go(/^Connections/);
    await userEvent.type(await screen.findByLabelText('Gmail app password'), 'qafakeqafakeqafk');
    await userEvent.click(within(screen.getByLabelText('Gmail app password').closest('.field')!).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText("Can't sign in")).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Gmail rejected the address or app password.');
    expect(screen.getByLabelText('Gmail app password')).toBeInTheDocument();
  });

  it('shows Connected with when it was verified once Gmail signs in', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveSettings({ gmailAddress: 'sam@gmail.com' });
    await api.setSecret('gmailAppPassword', 'abcd efgh ijkl mnop');
    renderWithApp(<SettingsPage params={{}} />, api);
    await go(/^Connections/);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText(/^Verified /)).toBeInTheDocument();
  });

  it('lets a connected Telegram bot get a new token', async () => {
    const api = createMockApi({ latencyMs: 0 });
    await api.saveSettings({ telegramChatId: '42' });
    await api.setSecret('telegramBotToken', '1:old');
    renderWithApp(<SettingsPage params={{}} />, api);
    await go(/^Connections/);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bot token')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change Telegram' }));
    await userEvent.type(screen.getByLabelText('Bot token'), '1:new');
    await userEvent.click(within(screen.getByLabelText('Bot token').closest('.field')!).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Telegram signed in')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('saves the weekly goal on blur', async () => {
    const { api } = renderWithApp(<SettingsPage params={{}} />);
    await go(/^Guardrails/);
    const field = await screen.findByLabelText('Applications to send per week (Dashboard goal)');
    await userEvent.clear(field);
    await userEvent.type(field, '20');
    await userEvent.tab();
    await vi.waitFor(async () => expect((await api.getSettings()).weeklyGoal).toBe(20));
  });

  it('shows five pill tabs, opens on Sources, and keeps each section on its own tab', async () => {
    renderWithApp(<SettingsPage params={{}} />);
    const tabs = within(await screen.findByRole('tablist', { name: 'Settings sections' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Sources', 'Channels', 'Guardrails', 'Connections', 'Files']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('switch', { name: 'Use Jobicy' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Open Applio at login' })).not.toBeInTheDocument();
    await go(/^Files/);
    expect(screen.getByRole('switch', { name: 'Open Applio at login' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name on your documents')).toBeInTheDocument();
  });

  it('is headed "My settings" and still says changes save automatically', async () => {
    renderWithApp(<SettingsPage params={{}} />);
    expect(await screen.findByRole('heading', { level: 1, name: 'My settings' })).toBeInTheDocument();
    expect(screen.getByText('Changes save automatically.')).toBeInTheDocument();
  });

  it('keeps a half-typed guardrail while the operator looks at another tab', async () => {
    renderWithApp(<SettingsPage params={{}} />);
    await go(/^Guardrails/);
    const field = screen.getByLabelText('Applications to send per week (Dashboard goal)');
    await userEvent.clear(field);
    await userEvent.type(field, '2');
    await go(/^Sources/);
    await go(/^Guardrails/);
    expect(screen.getByLabelText('Applications to send per week (Dashboard goal)')).toHaveValue('2');
  });

  it('opens on the tab named in the link, and falls back to Sources for an unknown one', async () => {
    const first = renderWithApp(<SettingsPage params={{ tab: 'guard' }} />);
    expect(await screen.findByRole('tab', { name: /^Guardrails/ })).toHaveAttribute('aria-selected', 'true');
    first.unmount();
    renderWithApp(<SettingsPage params={{ tab: 'nope' }} />);
    expect(await screen.findByRole('tab', { name: /^Sources/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('follows a link to another settings tab from inside the app', async () => {
    window.location.hash = '#/settings';
    renderWithApp(<App />);
    await screen.findByRole('tab', { name: /^Sources/ });
    window.location.hash = '#/settings/conn';
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Connections/ })).toHaveAttribute('aria-selected', 'true'));
    window.location.hash = '';
  });

  it('puts the tab in the link when it is clicked, so the same link works again afterwards', async () => {
    window.location.hash = '#/settings/guard';
    renderWithApp(<App />);
    await screen.findByRole('tab', { name: /^Guardrails/ });
    await userEvent.click(screen.getByRole('tab', { name: /^Sources/ }));
    expect(window.location.hash).toBe('#/settings/sources');
    // A link to Guardrails now changes the hash again, so the page follows it.
    window.location.hash = '#/settings/guard';
    await waitFor(() => expect(screen.getByRole('tab', { name: /^Guardrails/ })).toHaveAttribute('aria-selected', 'true'));
    window.location.hash = '';
  });

  it('corrects an unknown tab in the link to Settings', async () => {
    window.location.hash = '#/settings/typo';
    renderWithApp(<App />);
    await screen.findByRole('tab', { name: /^Sources/ });
    await waitFor(() => expect(window.location.hash).toBe('#/settings'));
    window.location.hash = '';
  });

  it('does not probe the connections until the Connections tab is opened', async () => {
    const api = createMockApi({ latencyMs: 0 });
    const testConnection = vi.spyOn(api, 'testConnection');
    renderWithApp(<SettingsPage params={{}} />, api);
    await screen.findByRole('tab', { name: /^Sources/ });
    expect(screen.queryByRole('radiogroup', { name: 'AI engine' })).not.toBeInTheDocument();
    expect(testConnection).not.toHaveBeenCalled();
  });
});
