import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { createBackend } from './backend';
import { registerApiHandlers } from './ipc';
import { denyAndOpenExternally, guardNavigation } from './security';

/** Set by scripts/dev.mjs; absent in a packaged build. */
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

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
  registerApiHandlers(createBackend(() => mainWindow), DEV_SERVER_URL);
  mainWindow = createWindow();

  // macOS: re-open a window when the dock icon is clicked.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

// ponytail: quits on last window close (except macOS); tray mode comes with the scheduler.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
