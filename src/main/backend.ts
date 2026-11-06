import { dialog, shell, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { discover } from '../core/jobs/discover';
import { localDay, runSources } from '../core/jobs/run-sources';
import { createScheduler } from '../core/jobs/scheduler';
import type { HttpGet, JobSource } from '../core/jobs/source';
import { createProfileService } from '../core/profile/profile-service';
import { createSettingsService } from '../core/settings/settings-service';
import {
  createActivityRepo, createJobsRepo, createPollsRepo, createProfileRepo, createSettingsRepo, createSourcesRepo, transaction,
} from '../infra/db';
import { readResumeText } from '../infra/resume/read-resume';
import type { SecretStore } from '../infra/secrets/secret-store';
import type { ApplioApi } from '../shared/api';
import type { AppStatus } from '../shared/types';
import { createMockApi } from '../shared/mock/mock-api';
import { isSafeExternalUrl } from './security';

/** Expands a leading `~` so stored folder paths work with the OS shell. */
const expandHome = (path: string) => (path.startsWith('~') ? homedir() + path.slice(1) : path);

/** Everything the backend persists to, the job sources it polls, and where status changes go. */
export interface BackendDeps {
  db: DatabaseSync;
  secrets: SecretStore;
  sources: readonly JobSource[];
  httpFor: (source: JobSource) => HttpGet;
  /** Pushes status to the page whenever it changes (scheduler AC-5). */
  onStatus: (status: AppStatus) => void;
  /** Registers or removes Applio as a login item (scheduler AC-6). */
  setLaunchAtLogin: (open: boolean) => void;
}

/** The API, plus the scheduler tick main runs every minute and on wake. */
export type Backend = ApplioApi & { tick(): Promise<void> };

const PAUSED_KEY = 'automationPaused';

/**
 * The backend the IPC layer serves. Profile, sources, settings and secrets are
 * real (SQLite + OS keychain); jobs, drafts and usage still come from the
 * in-memory store until their PRs land. OS integration is real.
 * ponytail: remaining in-memory data resets on restart — replace with SQLite-backed services per feature.
 */
export function createBackend(getWindow: () => BrowserWindow | null, { db, secrets, sources, httpFor, onStatus, setLaunchAtLogin }: BackendDeps): Backend {
  const store = createMockApi({ latencyMs: 0 });
  const kv = createSettingsRepo(db);
  const jobs = createJobsRepo(db);
  const activity = createActivityRepo(db);
  const polls = createPollsRepo(db);
  const sourcesRepo = createSourcesRepo(db);
  const settings = createSettingsService({ kv, sources: sourcesRepo, secrets });
  const profile = createProfileService({ store: createProfileRepo(db), kv, newId: randomUUID, now: () => new Date() });
  const isPaused = () => kv.get(PAUSED_KEY) === true;

  const runDiscovery = () =>
    discover({
      poll: () => runSources({ sources, isEnabled: (id) => sourcesRepo.get(id)?.enabled ?? false, polls, httpFor, today: () => localDay(new Date()) }),
      existingKeys: () => jobs.dedupKeys(),
      filters: () => ({ preferences: profile.getProfile().preferences, blocklist: settings.getSettings().blocklist }),
      save: (found, details, summary) =>
        transaction(db, () => {
          for (const { job, dedupKey } of found) jobs.insert(job, { dedupKey, createdAt: summary.at });
          activity.addRun(summary, details);
        }),
      now: () => new Date(),
      newId: randomUUID,
    });

  const scheduler = createScheduler({
    now: () => new Date(),
    intervalHours: () => settings.getSettings().discoveryIntervalHours,
    lastRunAt: () => activity.latestRun()?.at,
    isPaused,
    run: runDiscovery,
    onChange: () => pushStatus(),
    log: console.error,
  });

  const getStatus = (): AppStatus => {
    const { aiEngine, secretsSet, dailyTokenBudget } = settings.getSettings();
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return {
      engine: aiEngine,
      engineReady: aiEngine === 'claude-code' || secretsSet.anthropicApiKey,
      paused: isPaused(),
      nextRunAt: scheduler.nextRunAt(),
      tokensToday: activity.tokensSince(midnight),
      dailyTokenBudget,
      lastRun: activity.latestRun(),
    };
  };
  const pushStatus = () => onStatus(getStatus());

  /** Runs a synchronous service call as the async API method; a throw becomes a rejection. */
  const later = <A extends unknown[], R>(fn: (...args: A) => R) => async (...args: A) => fn(...args);

  /**
   * Opens a folder in Finder/Explorer. The UI already prefixes "Couldn't open the folder.",
   * so messages here say only why. A missing folder is checked first: the OS's own
   * answer for that ("Failed to open path") doesn't help the operator.
   */
  const openWithShell = async (path: string, missing: string) => {
    const full = expandHome(path);
    if (!existsSync(full)) throw new Error(missing);
    const error = await shell.openPath(full);
    if (error) throw new Error(`The system said: ${error}`);
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
    // Engine, budget and interval all show in the status card, so a save pushes it.
    saveSettings: later((patch) => {
      const next = settings.saveSettings(patch);
      if (patch.launchAtLogin !== undefined) setLaunchAtLogin(patch.launchAtLogin);
      pushStatus();
      return next;
    }),
    setSecret: later((key, value) => {
      const next = settings.setSecret(key, value);
      pushStatus();
      return next;
    }),

    getStatus: later(getStatus),
    runDiscovery: () => scheduler.runNow(),
    setAutomationPaused: later((paused) => {
      kv.set(PAUSED_KEY, paused);
      pushStatus();
      return getStatus();
    }),
    tick: () => scheduler.tick(),

    // Readiness is real; the live send/ping arrives with the Gmail, Telegram and AI adapter PRs.
    testConnection: async (kind) => {
      const { secretsSet, gmailAddress, telegramChatId, aiEngine } = settings.getSettings();
      const ready =
        kind === 'gmail' ? secretsSet.gmailAppPassword && !!gmailAddress
        : kind === 'telegram' ? secretsSet.telegramBotToken && !!telegramChatId
        : aiEngine === 'claude-code' || secretsSet.anthropicApiKey;
      if (!ready) return { ok: false, message: 'Missing credentials. Fill in the fields above first.' };
      return { ok: true, message: 'Credentials saved. A live test arrives with this integration.' };
    },

    openExternal: async (url) => {
      if (!isSafeExternalUrl(url)) throw new Error('Only web links can be opened');
      await shell.openExternal(url);
    },

    openJobFolder: async (jobId) => {
      const { folderPath } = await store.getJob(jobId);
      if (!folderPath) throw new Error('This job has no folder yet');
      await openWithShell(folderPath, "This job's folder isn't on disk yet. Applio creates it when it saves the application.");
    },

    openOutputFolder: async () => {
      const { outputFolder } = settings.getSettings();
      if (!outputFolder) throw new Error('Choose an output folder first');
      await openWithShell(outputFolder, `${outputFolder} no longer exists. Choose the folder again above.`);
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
