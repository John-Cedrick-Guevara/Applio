## Feature goal
Run Applio as a local desktop app where the page has no direct access to Node, files, network or secrets, and reaches the main process only through the allow-listed API (SPEC §2, CLAUDE.md §3).

## Acceptance criteria
- [ ] AC-1: `npm run dev` opens an Applio window loading the Vite dev server with live reload; `npm run build` produces `dist/electron/main.cjs`, `preload.cjs` and the renderer, and `npm start` opens the built app from `file://`.
- [ ] AC-2: The window runs with `contextIsolation`, `sandbox` and no `nodeIntegration`; in the page, `require` and `process` are undefined.
- [ ] AC-3: `window.applio` exposes exactly the methods in `API_METHODS`, each forwarding to its own IPC channel and returning the main process's result.
- [ ] AC-4: An IPC call from any frame that isn't the app (packaged file:// page or the dev server origin) is rejected and logged in main.
- [ ] AC-5: A failing call reaches the page as an Error whose message is only the readable text; main logs the method and the original error.
- [ ] AC-6: `target=_blank` links and `window.open` open in the system browser and never in a new app window; in-page navigation away from the app is blocked.
- [ ] AC-7: Only http(s) URLs are handed to the OS; `file:`, `javascript:` and malformed URLs are refused with a readable message.
- [ ] AC-8: Open folder, Choose folder and resume import use the OS (Finder/Explorer, native dialogs); cancelling a dialog returns no value and is not an error.

## Must not break
- MNB-1: `npm run dev:web` still runs the UI in a plain browser on the mock store.
- MNB-2: The preload bundle requires nothing except `electron`.

## Known risks
- `scripts/dev.mjs` does not rebuild main/preload on change; a restart is needed.
- No code signing or installer yet; macOS Gatekeeper will warn on other machines.

## Test plan
- AC-1: Manual: run `npm run dev`, edit a renderer file, see it reload; run `npm run build && npm start`.
- AC-2: Manual via DevTools console (or CDP): `typeof require`, `typeof process` are `"undefined"`.
- AC-3: Manual: `Object.keys(window.applio).length === API_METHODS.length`; call `listJobs()` and get data.
- AC-4: `security.test.ts` — `isAppUrl` for file://, dev origin, missing dev URL, foreign origin.
- AC-5: Manual: `await window.applio.approveDraft('j7')` rejects with "Job j7 is not awaiting approval"; main console shows `[ipc] approveDraft failed`.
- AC-6: Manual: click an external link in the app; it opens in the default browser and the app window stays. Additionally: `security.test.ts` unit-tests `denyAndOpenExternally` and `guardNavigation`, the handlers `src/main/index.ts` registers.
- AC-7: `security.test.ts` — `isSafeExternalUrl` cases; manual `openExternal('file:///etc/passwd')` rejects. Additionally: `backend.test.ts` asserts the OS is never called for a refused URL.
- AC-8: Manual: Settings → Change… folder, cancel and choose; Profile → Replace resume, cancel. Additionally: `backend.test.ts` covers chosen and cancelled pickers, `~` expansion and OS errors with a faked `electron` module.
- MNB-1: Manual: `npm run dev:web` loads with the mock warning in the console.
- MNB-2: `grep -o 'require("[^"]*")' dist/electron/preload.cjs` lists only electron.

## Out of scope
- Tray, launch at login, scheduler (PR-13).
- Argument validation (PR-9) and real data (Stage 2).
