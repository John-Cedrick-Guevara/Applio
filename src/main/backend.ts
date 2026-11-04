import { dialog, shell, type BrowserWindow } from 'electron';
import { homedir } from 'node:os';
import { basename } from 'node:path';
import type { ApplioApi } from '../shared/api';
import { createMockApi } from '../shared/mock/mock-api';
import { isSafeExternalUrl } from './security';

/** Expands a leading `~` so stored folder paths work with the OS shell. */
const expandHome = (path: string) => (path.startsWith('~') ? homedir() + path.slice(1) : path);

/**
 * The backend the IPC layer serves. Data still comes from the in-memory store;
 * OS integration (browser, Finder/Explorer, file pickers) is real.
 * ponytail: in-memory data resets on restart — replace with SQLite-backed services per feature.
 */
export function createBackend(getWindow: () => BrowserWindow | null): ApplioApi {
  const store = createMockApi({ latencyMs: 0 });

  return {
    ...store,

    openExternal: async (url) => {
      if (!isSafeExternalUrl(url)) throw new Error('Only web links can be opened');
      await shell.openExternal(url);
    },

    openJobFolder: async (jobId) => {
      const { folderPath } = await store.getJob(jobId);
      if (!folderPath) throw new Error('This job has no folder yet');
      const error = await shell.openPath(expandHome(folderPath));
      if (error) throw new Error(`Couldn't open the folder: ${error}`);
    },

    openOutputFolder: async () => {
      const { outputFolder } = await store.getSettings();
      if (!outputFolder) throw new Error('Choose an output folder first');
      const error = await shell.openPath(expandHome(outputFolder));
      if (error) throw new Error(`Couldn't open the folder: ${error}`);
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
      // ponytail: fact extraction not wired yet — records the file only.
      return { resume: { fileName: basename(file), uploadedAt: new Date().toISOString(), factsFound: 0 }, suggestions: [] };
    },
  };
}
