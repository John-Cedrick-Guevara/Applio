## Feature goal
Keep all of the operator's data in one local SQLite file that survives restarts and never leaves the machine (SPEC §2, principle "local-first").

## Acceptance criteria
- [ ] AC-1: On first launch the app creates its database in the OS app-data folder and applies all migrations; later launches apply only new migrations, in order, each once.
- [ ] AC-2: The schema stores jobs, status events, drafts, facts, fact groups, answers, sources, settings, run summaries and usage records, with indexes on the dedup key, status and created time.
- [ ] AC-3: Repositories read and write each entity; multi-row writes run in one transaction and roll back fully on error.
- [ ] AC-4: The database runs in WAL mode, and a failed migration stops startup with a readable error and leaves the previous schema intact.
- [ ] AC-5: All queries are parameterized.

## Must not break
- MNB-1: The UI keeps working on the mock-backed API until each slice is switched over (PR-10 onward).
- MNB-2: No secrets are stored in the database.

## Known risks
- Open question: `node:sqlite` (built in, no native build) vs `better-sqlite3` (mature, needs electron-rebuild). Recommended: `better-sqlite3`.
- Open question: whether the database lives in app data or inside the operator's output folder. Recommended: app data.

## Test plan
- AC-1: Test against a temp file: fresh run applies all migrations; second run applies none; a new migration applies once.
- AC-2: Test introspects tables and indexes after migrating.
- AC-3: Repository tests on an in-memory database, including a forced error mid-transaction that leaves no partial rows.
- AC-4: Test reads `journal_mode`; test with a broken migration asserts startup error and unchanged schema.
- AC-5: Code review plus a test inserting a value containing quotes and SQL keywords.
- MNB-1: Full test suite and a manual app run.
- MNB-2: Schema review: no columns for passwords, tokens or keys.

## Out of scope
- Wiring repositories to API methods (PR-10 onward). Backups and export.
