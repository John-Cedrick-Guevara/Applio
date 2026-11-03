## Feature goal
Use the operator's own Claude access (Claude Code subscription by default, API key as fallback) through one interface, and never spend past the token budget (SPEC §2, F10).

## Acceptance criteria
- [ ] AC-1: With Claude Code selected, Applio runs `claude -p --output-format stream-json --strict-mcp-config` with only Applio's MCP tools and reads the result and token usage.
- [ ] AC-2: With API key selected, the same requests go to the Anthropic API using the key from the keychain.
- [ ] AC-3: Every AI call records input and output tokens against its run, job and step (score, tailor, answers, prep, follow-up).
- [ ] AC-4: At 80% of the daily or monthly budget a warning is raised; at 100% AI calls stop and work waits until the budget resets or the operator raises it.
- [ ] AC-5: If Claude Code isn't installed or signed in, the engine shows "Needs setup" with a readable reason, and Settings offers the API key fallback.
- [ ] AC-6: The engine card and Settings show whether the engine is ready.

## Must not break
- MNB-1: No AI call is made while automation is paused, except ones the operator triggers.
- MNB-2: Prompts never include secrets.

## Known risks
- Anthropic terms for a desktop app invoking headless Claude Code need confirming (SPEC §6).
- Open question: default model per step (scoring could use a smaller model). Recommended: decide in this spec's review.

## Test plan
- AC-1: Tests with a fake `claude` binary emitting stream-json; asserts flags and parsed usage.
- AC-2: Tests with a mocked API client.
- AC-3: Test asserts usage rows per call.
- AC-4: Tests at 79%, 80% and 100% for daily and monthly budgets.
- AC-5: Test with the binary missing; manual check of the Settings message.
- AC-6: Manual: switch engines with and without a key.
- MNB-1: Test: paused → scheduled AI call refused, operator-triggered allowed.
- MNB-2: Test captures prompts and asserts no secret values.

## Out of scope
- What the prompts do (PR-16, PR-17, PR-21, PR-23).
