## Feature goal
Make the operator's profile, sources and settings real and persistent, with credentials kept only in the OS keychain (SPEC F1, CLAUDE.md §3).

## Acceptance criteria
- [ ] AC-1: Facts, fact groups, skills, answers, preferences, sources and settings edited in the UI persist across app restarts.
- [ ] AC-2: `setSecret` stores the value with Electron `safeStorage` in the OS keychain; `secretsSet` reflects what is stored; no API returns a secret.
- [ ] AC-3: Importing a PDF or DOCX resume extracts candidate facts; they are shown for review and only enter the fact bank once the operator accepts them; the reference resume card updates.
- [ ] AC-4: A resume that can't be read shows a readable error and changes nothing.
- [ ] AC-5: First launch seeds default sources and settings (draft 75, auto 85, 10 per channel per day, 150k tokens per day, assisted fill off).

## Must not break
- MNB-1: Profile, Settings and Add job screens behave as in PR-6a, PR-7a and PR-7b.
- MNB-2: Secrets never appear in the database, logs or output folder.

## Known risks
- Open question: should imported facts need explicit acceptance (recommended, matches "never invent") or go straight into the bank?
- If `safeStorage` is unavailable (some Linux setups), saving a secret must fail clearly rather than fall back to plain text.

## Test plan
- AC-1: Service tests on a temp database: write, reopen, read; manual restart check.
- AC-2: Tests with a fake safeStorage: stored, `secretsSet` true, `getSettings` has no value.
- AC-3: Tests with fixture PDF and DOCX resumes; manual accept flow.
- AC-4: Test with a corrupt file returns a readable error and no changes.
- AC-5: Test on an empty database checks seeded defaults.
- MNB-1: Existing page tests plus a manual pass in Electron.
- MNB-2: Test greps the database file and captured logs for a test secret.

## Out of scope
- Using profile data for scoring or generation (PR-16, PR-17).
