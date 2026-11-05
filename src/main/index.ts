import { app, BrowserWindow, dialog, safeStorage, shell } from 'electron';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../infra/db';
import { createSecretStore } from '../infra/secrets/secret-store';
import { createBackend } from './backend';
import { registerApiHandlers } from './ipc';
import { denyAndOpenExternally, guardNavigation } from './security';

/** Set by scripts/dev.mjs; absent in a packaged build. */
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let db: DatabaseSync | null = null;

/** The one Applio folder: the database plus every generated application (SPEC F8). */
const dataFolder = () => join(app.getPath('home'), 'Applio');

/**
 * Creates the app window with a locked-down renderer: no Node, isolated
 * context, sandboxed preload. Links leave the app for the system browser.
 */
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Applio',
    backgroundColor: '#F5F6F8',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  const openInBrowser = (url: string) => void shell.openExternal(url);
  // target=_blank / window.open → system browser; never a second app window.
  win.webContents.setWindowOpenHandler(denyAndOpenExternally(openInBrowser));
  // In-page navigation may only stay inside the app.
  win.webContents.on('will-navigate', guardNavigation(DEV_SERVER_URL, openInBrowser));

  if (DEV_SERVER_URL) void win.loadURL(DEV_SERVER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));

  win.on('closed', () => {
    mainWindow = null;
  });
  return win;
}

app.whenReady().then(() => {
  try {
    db = openDatabase(join(dataFolder(), 'applio.db'));
  } catch (err) {
    console.error('[db] failed to open', err);
    dialog.showErrorBox("Applio can't open its data", err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }
  // Secrets sit in the OS app-data folder, never in the Applio folder the operator browses and shares.
  const secrets = createSecretStore(safeStorage, join(app.getPath('userData'), 'secrets.json'));
  registerApiHandlers(createBackend(() => mainWindow, { db, secrets }), DEV_SERVER_URL);
  mainWindow = createWindow();

  // macOS: re-open a window when the dock icon is clicked.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('will-quit', () => db?.close());

// ponytail: quits on last window close (except macOS); tray mode comes with the scheduler.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
