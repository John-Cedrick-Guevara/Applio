## Feature goal
Run Applio's Claude Code calls under Applio's own Claude Code profile, so nothing from the operator's personal Claude Code setup (hooks, plugins, skills, settings, memory) can ever reach them (QA F7).

## Acceptance criteria
- [x] AC-1: Every Claude Code call Applio makes, including the readiness check, uses Applio's own profile folder in its app data (`CLAUDE_CONFIG_DIR`), never the operator's `~/.claude`.
- [x] AC-2: Until that profile is signed in, the engine shows "Needs setup" with the exact one-line sign-in command, which Settings shows with a Copy button.
- [x] AC-3: Once signed in (same account and subscription), Test shows Claude Code as ready, with no restart.

## Must not break
- MNB-1: The API-key engine is unaffected.
- MNB-2: Hooks stay switched off (`disableAllHooks`), so a hook added to Applio's profile later still can't run.

## Decisions (2026-11-06, agreed with the requester)
- A separate profile is stronger than switching the operator's setup off flag by flag: their hooks, plugins, skills, settings and memory are simply not there.
- Signing in happens in a terminal, because Claude Code's sign-in is interactive (browser and callback). Applio shows the exact command for this install and checks again on Test.
- Existing installs will show "Needs setup" once, until the one-time sign-in.

## Known risks
- If Claude Code changes how `CLAUDE_CONFIG_DIR` works, the readiness check says so ("isn't signed in") rather than failing silently.

## Test plan
- AC-1: `claude-code-engine.test.ts`: the fake `claude` records `CLAUDE_CONFIG_DIR` for both a call and the readiness check.
- AC-2: `claude-code-engine.test.ts`: logged out → not ready, with the command; `settings-page.test.tsx`: the command shows with Copy.
- AC-3: `backend.test.ts` › "tests the selected AI engine and shows Claude Code's reason when it needs setup" (Test re-checks every time) and "passes on the command that fixes the engine, so Settings can show it".
- MNB-1: existing API-engine tests.
- MNB-2: `claude-code-engine.test.ts` › hooks stay off (existing).

## Out of scope
- Signing in from inside Applio, without a terminal.
