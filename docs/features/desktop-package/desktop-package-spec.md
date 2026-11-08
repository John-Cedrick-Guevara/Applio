## Feature goal
Install Applio as a real macOS app (`/Applications/Applio.app`), so the operator opens it from Launchpad or the Dock instead of running npm in a terminal. It keeps using the same data (`~/Applio`) and the same sign-ins (Electron's `applio` app-data folder).

## Acceptance criteria
- AC-1: `npm run package` cleans `dist/`, builds, and produces `release/mac-arm64/Applio.app`, ad-hoc signed, with a signature that verifies.
- AC-2: The app holds only the built `dist/`. No `node_modules` ship, because every dependency is bundled by Vite.
- AC-3: Claude Code can start the MCP server from the installed app: `mcp.cjs` ships unpacked, and main points at `app.asar.unpacked`.
- AC-4: The installed app uses the same app name (`applio`), so the existing database, secrets file and Claude Code profile are found.
- AC-5: A saved secret the keychain won't decrypt (access denied, or a new signature after a rebuild) gives a clear next step instead of Electron's raw error.

## Must not break
- MNB-1: `npm start` and `npm run dev` from the repo, where paths outside an archive are left as they are.

## Test plan
- AC-1/2: `npm run package`; `codesign --verify --deep --strict`; `asar list` shows no `node_modules` (checked manually)
- AC-3: `mcp-config.test.ts` › `outsideAsar`; smoke test: the packaged binary in Node mode on the unpacked `mcp.cjs` answers `initialize` and lists all 6 tools
- AC-4: the packaged `package.json` name is `applio` (checked)
- AC-5: `secret-store.test.ts` › "says plainly when the keychain won't decrypt a saved secret, with the fix"
- MNB-1: full suite; `outsideAsar` leaves repo paths unchanged

## Decisions
- New dev dependency: `electron-builder` (26). It's the standard Electron packager, handles asar/unpack and ad-hoc signing, and nothing already installed packages apps.
- arm64 only, a `dir` target (no DMG), and the default Electron icon. The ad-hoc signature means macOS asks once for keychain access after each rebuild (Always Allow).
- Hardened runtime is off: it needs a Developer ID, and with an ad-hoc signature it can block the app's own libraries.

## Out of scope
- A Developer ID signature, notarization, auto-update, an app icon, and Intel builds.
