## Feature goal
Give Claude a small, safe set of tools to read the profile and save results, so sending, form filling and PDFs stay in the app (SPEC §4).

## Acceptance criteria
- [ ] AC-1: A local MCP server exposes exactly `get_profile`, `get_jobs`, `save_match`, `save_draft`, `get_answers`, `log_event`.
- [ ] AC-2: Every tool validates its input and rejects anything else with an error Claude can read.
- [ ] AC-3: `save_draft` rejects drafts that cite fact IDs not in the fact bank.
- [ ] AC-4: `get_profile` never returns secrets or settings; `get_jobs` returns only the jobs of the current run.
- [ ] AC-5: The server is reachable only from the engine Applio starts, not from other local processes.

## Must not break
- MNB-1: Tool definitions stay small (target under ~1k tokens total).

## Known risks
- Transport choice (stdio vs local socket) affects AC-5; stdio is recommended.

## Test plan
- AC-1: Test lists tools and compares names.
- AC-2: Per-tool tests with valid and invalid input.
- AC-3: Test with an unknown fact ID.
- AC-4: Tests inspect `get_profile` output and run scoping.
- AC-5: Test that the server only speaks over the spawned engine's stdio.
- MNB-1: Test measures serialized tool definitions.

## Out of scope
- Sending, form filling and PDF rendering (app-side, later PRs).
