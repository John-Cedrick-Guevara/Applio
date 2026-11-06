import { app, BrowserWindow, dialog, powerMonitor, safeStorage, shell } from 'electron';
import { delimiter, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { createApiEngine } from '../infra/ai/api-engine';
import { createClaudeCodeEngine } from '../infra/ai/claude-code-engine';
import { openDatabase } from '../infra/db';
import { submitAtsForm } from '../infra/browser/ats-window';
import { printPdf } from '../infra/pdf/print-pdf';
import { createSecretStore } from '../infra/secrets/secret-store';
import { createToolPorts } from '../mcp/db-ports';
import { createTools } from '../mcp/tools';
import { createAllSources, createPoliteHttp, SOURCE_HOSTS } from '../infra/sources';
import { STATUS_CHANNEL } from '../shared/ipc';
import { createBackend } from './backend';
import { registerApiHandlers } from './ipc';
import { mcpConfigFor } from './mcp-config';
import { denyAndOpenExternally, guardNavigation } from './security';
import { createTray } from './tray';

/** Set by scripts/dev.mjs; absent in a packaged build. */
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;
let db: DatabaseSync | null = null;
// Closing the window only hides it (tray mode); Quit from the tray or the app menu sets this.
let quitting = false;

/** How often the scheduler checks whether a run is due; also checked on wake. */
const TICK_MS = 60_000;
/** Names the app and links its repo, as the boards ask; never a personal email. */
const USER_AGENT = 'Applio/0.1 (+https://github.com/John-Cedrick-Guevara/Applio)';

/**
 * PATH for spawning `claude`. An app opened from Finder or at login doesn't get the
 * shell's PATH, so add the places Claude Code's installers use.
 */
const enginePath = () =>
  [process.env.PATH, join(app.getPath('home'), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(delimiter);

/** The one Applio folder: the database plus every generated application (SPEC F8). */
const dataFolder = () => join(app.getPath('home'), 'Applio');
const dbPath = () => join(dataFolder(), 'applio.db');

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

  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on('closed', () => {
    mainWindow = null;
  });
  return win;
}

app.whenReady().then(() => {
  try {
    db = openDatabase(dbPath());
  } catch (err) {
    console.error('[db] failed to open', err);
    dialog.showErrorBox("Applio can't open its data", err instanceof Error ? err.message : String(err));
    app.quit();
    return;
  }
  // Secrets sit in the OS app-data folder, never in the Applio folder the operator browses and shares.
  const appDb = db;
  const secrets = createSecretStore(safeStorage, join(app.getPath('userData'), 'secrets.json'));
  const http = createPoliteHttp({
    fetch: (url, init) => fetch(url, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random: Math.random,
    userAgent: USER_AGENT,
    allowedHosts: SOURCE_HOSTS,
  });
  // The tray reads `paused` from each pushed status, so it never has to ask.
  let paused = false;
  let refreshTray = () => {};
  const backend = createBackend(() => mainWindow, {
    db,
    secrets,
    // ponytail: the ATS watchlist is empty until its editor lands; then read it from settings here.
    sources: createAllSources(() => []),
    httpFor: (source) => http.forSource(source.id),
    onStatus: (status) => {
      paused = status.paused;
      mainWindow?.webContents.send(STATUS_CHANNEL, status);
      refreshTray();
    },
    setLaunchAtLogin: (openAtLogin) => app.setLoginItemSettings({ openAtLogin }),
    printPdf,
    // The operator approved this send, so they watch it fill; autonomous sends (PR-20) run hidden.
    submitAts: (request) => submitAtsForm({ ...request, visible: true }),
    engines: {
      'claude-code': createClaudeCodeEngine({
        command: 'claude',
        // App data, not a project folder, so no CLAUDE.md or project settings load.
        cwd: app.getPath('userData'),
        env: { ...process.env, PATH: enginePath() },
        // Only Applio's server; --strict-mcp-config keeps the operator's own MCP servers out.
        mcpConfig: (jobIds) => mcpConfigFor({ execPath: process.execPath, script: join(__dirname, 'mcp.cjs'), dbPath: dbPath() }, jobIds),
      }),
      'api-key': createApiEngine({
        apiKey: () => secrets.get('anthropicApiKey'),
        // The same tools as the MCP server, run in-process (MCP MNB-2).
        tools: (jobIds) => createTools(createToolPorts(appDb, jobIds, () => new Date())),
      }),
    },
  });
  registerApiHandlers(backend, DEV_SERVER_URL);
  mainWindow = createWindow();

  const show = () => {
    if (!mainWindow) mainWindow = createWindow();
    mainWindow.show();
    mainWindow.focus();
  };
  refreshTray = createTray({
    open: show,
    runNow: () => void backend.runDiscovery().catch((err: unknown) => console.error('[tray] run failed', err)),
    isPaused: () => paused,
    setPaused: (next) => void backend.setAutomationPaused(next),
    quit: () => app.quit(),
  });
  void backend.getStatus().then((s) => {
    paused = s.paused;
    refreshTray();
  });

  // Catch-up: a run missed while asleep starts on the first tick after wake (or launch).
  const tick = () => void backend.tick();
  tick();
  setInterval(tick, TICK_MS);
  powerMonitor.on('resume', tick);

  // macOS: re-open the window when the dock icon is clicked.
  app.on('activate', show);
});

app.on('before-quit', () => {
  quitting = true;
});
app.on('will-quit', () => db?.close());

// Tray mode: Applio keeps running with every window closed; Quit lives in the tray menu.
app.on('window-all-closed', () => {});
