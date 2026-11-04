import { dialog, shell, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { basename } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { createProfileService } from '../core/profile/profile-service';
import { createSettingsService } from '../core/settings/settings-service';
import { createProfileRepo, createSettingsRepo, createSourcesRepo } from '../infra/db';
import { readResumeText } from '../infra/resume/read-resume';
import type { SecretStore } from '../infra/secrets/secret-store';
import type { ApplioApi } from '../shared/api';
import { createMockApi } from '../shared/mock/mock-api';
import { isSafeExternalUrl } from './security';

/** Expands a leading `~` so stored folder paths work with the OS shell. */
const expandHome = (path: string) => (path.startsWith('~') ? homedir() + path.slice(1) : path);

/** Everything the backend persists to: the Applio database and the keychain-backed secret file. */
export interface BackendDeps {
  db: DatabaseSync;
  secrets: SecretStore;
}

/**
 * The backend the IPC layer serves. Profile, sources, settings and secrets are
 * real (SQLite + OS keychain); jobs, drafts and usage still come from the
 * in-memory store until their PRs land. OS integration is real.
 * ponytail: remaining in-memory data resets on restart — replace with SQLite-backed services per feature.
 */
export function createBackend(getWindow: () => BrowserWindow | null, { db, secrets }: BackendDeps): ApplioApi {
  const store = createMockApi({ latencyMs: 0 });
  const kv = createSettingsRepo(db);
  const settings = createSettingsService({ kv, sources: createSourcesRepo(db), secrets });
  const profile = createProfileService({ store: createProfileRepo(db), kv, newId: randomUUID, now: () => new Date() });

  /** Runs a synchronous service call as the async API method; a throw becomes a rejection. */
  const later = <A extends unknown[], R>(fn: (...args: A) => R) => async (...args: A) => fn(...args);

  const openWithShell = async (path: string) => {
    const error = await shell.openPath(expandHome(path));
    if (error) throw new Error(`Couldn't open the folder: ${error}`);
  };

  return {
    ...store,

    getProfile: later(profile.getProfile),
    saveFact: later(profile.saveFact),
    deleteFact: later(profile.deleteFact),
    saveAnswer: later(profile.saveAnswer),
    deleteAnswer: later(profile.deleteAnswer),
    savePreferences: later(profile.savePreferences),

    listSources: later(settings.listSources),
    updateSource: later(settings.updateSource),
    getSettings: later(settings.getSettings),
    saveSettings: later(settings.saveSettings),
    setSecret: later(settings.setSecret),

    // Engine readiness and the token budget come from the real settings; the rest is still the mock scheduler.
    getStatus: async () => {
      const { aiEngine, secretsSet, dailyTokenBudget } = settings.getSettings();
      return { ...(await store.getStatus()), engine: aiEngine, engineReady: aiEngine === 'claude-code' || secretsSet.anthropicApiKey, dailyTokenBudget };
    },

    openExternal: async (url) => {
      if (!isSafeExternalUrl(url)) throw new Error('Only web links can be opened');
      await shell.openExternal(url);
    },

    openJobFolder: async (jobId) => {
      const { folderPath } = await store.getJob(jobId);
      if (!folderPath) throw new Error('This job has no folder yet');
      await openWithShell(folderPath);
    },

    openOutputFolder: async () => {
      const { outputFolder } = settings.getSettings();
      if (!outputFolder) throw new Error('Choose an output folder first');
      await openWithShell(outputFolder);
    },

    chooseFolder: async () => {
      const win = getWindow();
      const options = { properties: ['openDirectory', 'createDirectory'] as const };
      const result = win ? await dialog.showOpenDialog(win, { ...options, properties: [...options.properties] }) : await dialog.showOpenDialog({ properties: [...options.properties] });
      return result.canceled ? null : (result.filePaths[0] ?? null);
    },

    importResume: async () => {
      const win = getWindow();
      const options: Electron.OpenDialogOptions = { properties: ['openFile'], filters: [{ name: 'Resume', extensions: ['pdf', 'docx'] }] };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      const file = result.filePaths[0];
      if (result.canceled || !file) return null;
      // Read first: an unreadable file throws here, before anything is recorded.
      const text = await readResumeText(file);
      return profile.recordResume(basename(file), text);
    },
  };
}
