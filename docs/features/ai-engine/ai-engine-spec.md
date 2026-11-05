## Feature goal
Use the operator's own Claude access (Claude Code subscription by default, API key as fallback) through one interface, and never spend past the token budget (SPEC §2, F10).

## Acceptance criteria
- [x] AC-1: With Claude Code selected, Applio runs `claude -p --output-format stream-json --strict-mcp-config` with only Applio's MCP tools and reads the result and token usage.
- [x] AC-2: With API key selected, the same requests go to the Anthropic API using the key from the keychain.
- [x] AC-3: Every AI call records input and output tokens against its run, job and step (score, tailor, answers, prep, follow-up).
- [x] AC-4: At 80% of the daily or monthly budget a warning is raised; at 100% AI calls stop and work waits until the budget resets or the operator raises it.
- [x] AC-5: If Claude Code isn't installed or signed in, the engine shows "Needs setup" with a readable reason, and Settings offers the API key fallback.
- [x] AC-6: The engine card and Settings show whether the engine is ready.

## Must not break
- MNB-1: No AI call is made while automation is paused, except ones the operator triggers.
- MNB-2: Prompts never include secrets.

## Decisions (defaults picked while building, 2026-11-05; change any in review)
- Model: the API engine uses `claude-opus-5-5` for every step. Claude Code uses whatever model the operator's subscription defaults to. A cheaper model for scoring is the operator's call; it's one constant to change.
- On the API engine, refusals fall back server-side (`fallbacks: "default"`), so a policy decline on one model is retried on another inside the same call.
- Claude Code runs with built-in tools off (`--tools ""`), no saved session, `--strict-mcp-config`, and an empty MCP config until PR-15 adds Applio's server. It runs in Applio's app-data folder, so no project's `CLAUDE.md` is loaded. The prompt goes in on stdin, never as an argument.
- Budgets: the daily budget already in Settings, plus a new monthly budget (default 3,000,000 tokens) next to it in Guardrails. "Today" and "this month" are the operator's local calendar.
- The 80% warning is logged and pushed with status. Telegram picks it up in PR-22.
- Readiness: Claude Code is ready when `claude auth status --json` says it's logged in. The API engine is ready when a key is saved. Test connection for AI does a real but free check: `claude auth status` for Claude Code, and a model lookup (no tokens) for the API key.

## Found while building
- Nothing calls the AI yet. `createAi` (pause, budgets, usage, the 80% warning) is wired in PR-16, the first PR that spends tokens.
- Main adds `~/.local/bin`, `/opt/homebrew/bin` and `/usr/local/bin` to PATH for `claude`, since an app opened from Finder doesn't inherit the shell's PATH.
- New dependency: `@anthropic-ai/sdk`, the official client for the API-key engine.

## Known risks
- Anthropic terms for a desktop app invoking headless Claude Code need confirming (SPEC §6).
- The stream-json shape is read from Claude Code's documented `result` event. Tests use a fake binary that emits it, so a format change shows up only in a real run.

## Test plan
- AC-1: `claude-code-engine.test.ts` runs a fake `claude` script: asserts the flags, that the prompt arrived on stdin, and the parsed result and usage. It also covers an error result and a crash.
- AC-2: `api-engine.test.ts` with a fake SDK client: model, key and usage mapping.
- AC-3: `ai-service.test.ts` asserts the usage row per call (step, job, run, input and output); `records.test.ts` round-trips input and output tokens.
- AC-4: `ai-service.test.ts` at 79%, 80% and 100% for daily and monthly; a refused call doesn't reach the engine.
- AC-5: Fake binary missing, and logged out: readable reasons. Manual check of the Settings message.
- AC-6: `backend.test.ts`: status `engineReady` follows the check. Manual: switch engines with and without a key.
- MNB-1: `ai-service.test.ts`: paused refuses a scheduled call and allows an operator-triggered one.
- MNB-2: `api-engine.test.ts` captures the request and asserts the key appears nowhere in it.

## Out of scope
- What the prompts do (PR-16, PR-17, PR-21, PR-23).
- Applio's MCP tools (PR-15).
