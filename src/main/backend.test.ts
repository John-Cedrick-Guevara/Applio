// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  shell: { openExternal: vi.fn(), openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));
vi.mock('electron', () => electron);

// A throwaway home, so `~/…` paths resolve somewhere the test controls.
const home = vi.hoisted(() => ({ dir: '' }));
vi.mock('node:os', async (original) => ({ ...(await original<typeof import('node:os')>()), homedir: () => home.dir }));

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../infra/db';
import { createSecretStore, type Encryptor } from '../infra/secrets/secret-store';
import { createBackend, type BackendDeps } from './backend';

const fakeEncryptor: Encryptor = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from([...s].reverse().join('')),
  decryptString: (b) => [...b.toString()].reverse().join(''),
};
const RESUMES = join(__dirname, '../infra/resume/fixtures');

let dir = '';
/** A backend over a temp Applio folder; call again with the same folder to simulate a restart. */
const backendIn = (folder = (dir = mkdtempSync(join(tmpdir(), 'applio-backend-')))) => {
  const deps: BackendDeps = { db: openDatabase(join(folder, 'applio.db')), secrets: createSecretStore(fakeEncryptor, join(folder, 'secrets.json')) };
  return { api: createBackend(() => null, deps), deps, folder };
};

beforeEach(() => {
  home.dir = mkdtempSync(join(tmpdir(), 'applio-home-'));
  electron.shell.openExternal.mockResolvedValue(undefined);
  electron.shell.openPath.mockResolvedValue('');
});
afterEach(() => {
  rmSync(home.dir, { recursive: true, force: true });
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('createBackend OS integration', () => {
  it('opens web links in the system browser and refuses other schemes', async () => {
    const { api } = backendIn();
    await api.openExternal('https://example.com/job');
    expect(electron.shell.openExternal).toHaveBeenCalledWith('https://example.com/job');
    await expect(api.openExternal('file:///etc/passwd')).rejects.toThrow('Only web links can be opened');
    expect(electron.shell.openExternal).toHaveBeenCalledTimes(1);
  });

  it('returns the chosen folder, or null when the picker is cancelled', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/Users/me/JobApps'] });
    expect(await api.chooseFolder()).toBe('/Users/me/JobApps');
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await api.chooseFolder()).toBeNull();
  });

  it('imports nothing when the resume picker is cancelled', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await api.importResume()).toBeNull();
  });

  it("opens a job's folder with the home directory expanded, and passes on what the OS says when it can't", async () => {
    const { api } = backendIn();
    const { folderPath } = await api.getJob('j1');
    mkdirSync(join(home.dir, folderPath!.slice(1)), { recursive: true });
    await api.openJobFolder('j1');
    expect(electron.shell.openPath).toHaveBeenCalledWith(join(home.dir, folderPath!.slice(1)));
    electron.shell.openPath.mockResolvedValueOnce('Permission denied');
    await expect(api.openJobFolder('j1')).rejects.toThrow(new Error('The system said: Permission denied'));
  });

  it("says plainly when a job's folder isn't on disk, without asking the OS", async () => {
    const { api } = backendIn();
    await expect(api.openJobFolder('j1')).rejects.toThrow(new Error("This job's folder isn't on disk yet. Applio creates it when it saves the application."));
    await expect(api.openJobFolder('j6')).rejects.toThrow(new Error('This job has no folder yet'));
    expect(electron.shell.openPath).not.toHaveBeenCalled();
  });

  it("says plainly when the output folder isn't on disk", async () => {
    const { api } = backendIn();
    await api.saveSettings({ outputFolder: '~/Gone' });
    await expect(api.openOutputFolder()).rejects.toThrow(new Error('~/Gone no longer exists. Choose the folder again above.'));
    expect(electron.shell.openPath).not.toHaveBeenCalled();
  });
});

describe('createBackend profile, settings and secrets on disk', () => {
  it('keeps profile, sources and settings edits across a restart', async () => {
    const first = backendIn();
    const fact = await first.api.saveFact({ group: 'Projects', text: 'Built an Electron app.' });
    await first.api.saveAnswer({ question: 'Notice period', answer: '2 weeks' });
    const prefs = { targetRoles: ['Backend'], seniority: 'Senior', employmentTypes: ['contract' as const], remoteOnly: true, hoursOverlap: '4h', minimumPay: '$90k' };
    await first.api.savePreferences(prefs);
    await first.api.updateSource('remoteok', { enabled: false });
    await first.api.saveSettings({ draftThreshold: 70, blocklist: ['Initech'] });
    first.deps.db.close();

    const { api } = backendIn(first.folder);
    const profile = await api.getProfile();
    expect(profile.facts).toEqual([fact]);
    expect(profile.factGroups).toEqual([{ name: 'Projects' }]);
    expect(profile.answers.map((a) => a.answer)).toEqual(['2 weeks']);
    expect(profile.preferences).toEqual(prefs);
    expect((await api.listSources()).find((s) => s.id === 'remoteok')?.enabled).toBe(false);
    expect(await api.getSettings()).toMatchObject({ draftThreshold: 70, blocklist: ['Initech'] });
  });

  it('starts a fresh install with the default sources and guardrails', async () => {
    const { api } = backendIn();
    expect(await api.listSources()).toHaveLength(11);
    expect(await api.getSettings()).toMatchObject({ draftThreshold: 75, autoSendThreshold: 85, maxPerChannelPerDay: 10, dailyTokenBudget: 150_000, assistedFill: { platform: false, custom: false } });
    expect((await api.getProfile()).facts).toEqual([]);
  });

  it('keeps secrets out of the database, the settings and the Applio folder files', async () => {
    const { api, deps, folder } = backendIn();
    const secret = 'sk-ant-test-secret-4242';
    const settings = await api.setSecret('anthropicApiKey', secret);
    expect(settings.secretsSet.anthropicApiKey).toBe(true);
    expect(deps.secrets.get('anthropicApiKey')).toBe(secret);
    expect(JSON.stringify(await api.getSettings())).not.toContain(secret);
    expect((await api.getStatus()).engineReady).toBe(true);
    deps.db.close();
    for (const file of readdirSync(folder)) expect(readFileSync(join(folder, file)).toString('latin1')).not.toContain(secret);
  });

  it('checks connection readiness against the saved settings and secrets', async () => {
    const { api } = backendIn();
    expect(await api.testConnection('telegram')).toEqual({ ok: false, message: 'Missing credentials. Fill in the fields above first.' });
    await api.saveSettings({ telegramChatId: '12345' });
    await api.setSecret('telegramBotToken', '123:abc');
    expect(await api.testConnection('telegram')).toMatchObject({ ok: true });
  });

  it('suggests facts from an imported resume and adds none until accepted', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [join(RESUMES, 'resume.docx')] });
    const result = await api.importResume();
    expect(result?.resume).toMatchObject({ fileName: 'resume.docx', factsFound: 3 });
    expect(result?.suggestions[0]).toEqual({ group: 'Acme Corp - Senior Engineer', text: 'Cut p95 query time from 900 ms to 120 ms by redesigning the invoicing schema.' });
    const profile = await api.getProfile();
    expect(profile.facts).toEqual([]);
    expect(profile.referenceResume?.fileName).toBe('resume.docx');
  });

  it('reports an unreadable resume and changes nothing', async () => {
    const { api } = backendIn();
    electron.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [join(RESUMES, 'corrupt.pdf')] });
    await expect(api.importResume()).rejects.toThrow("Applio couldn't read corrupt.pdf");
    expect((await api.getProfile()).referenceResume).toBeUndefined();
  });
});
