## Feature goal
Give Claude a small, safe set of tools to read the profile and save results, so sending, form filling and PDFs stay in the app (SPEC §4).

## Acceptance criteria
- [x] AC-1: A local MCP server exposes exactly `get_profile`, `get_jobs`, `save_match`, `save_draft`, `get_answers`, `log_event`.
- [x] AC-2: Every tool validates its input and rejects anything else with an error Claude can read.
- [x] AC-3: `save_draft` rejects drafts that cite fact IDs not in the fact bank.
- [x] AC-4: `get_profile` never returns secrets or settings; `get_jobs` returns only the jobs of the current run.
- [x] AC-5: The server is reachable only from the engine Applio starts, not from other local processes.

## Must not break
- MNB-1: Tool definitions stay small (target under ~1k tokens total).
- MNB-2: The API-key engine offers the same six tools, with the same checks, as Claude Code does.

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- Transport: stdio. Claude Code starts the server itself from Applio's MCP config: Electron's own binary run as Node (`ELECTRON_RUN_AS_NODE=1`) on `dist/electron/mcp.cjs`. There's no port or socket, so no other process can reach it (AC-5).
- Scope: each AI call names the jobs it's about. The server gets them in its environment, and `get_jobs`, `save_match`, `save_draft` and `log_event` refuse any other job.
- The tools live in one module. Claude Code reaches them over MCP, and the API-key engine calls the same handlers in its own tool loop (at most 12 turns), so both engines behave alike (MNB-2).
- The protocol is hand-written: newline-delimited JSON-RPC with `initialize`, `tools/list`, `tools/call` and `ping`, about 80 lines. That's simpler than adding the MCP SDK for six tools.
- `save_match` stores the score, both summaries, strengths and gaps, and moves a `found` job to `scored`.
- `save_draft` stores the résumé (every bullet cites a fact ID), the cover letter or proposal, and suggested answers. Unknown fact IDs are rejected by name, so Claude can fix them.
- `log_event` adds a note to the job's timeline without changing its status.
- `get_jobs` marks posting text as untrusted data in its description (CLAUDE.md §1.6).
- The server and main share the SQLite file, so the database now waits up to 5 s for a lock instead of failing.

## Found while building
- Found in review: in print mode Claude Code denies any tool that needs a permission prompt, MCP tools included. The engine now passes `--allowedTools mcp__applio`, so Applio's six tools work and nothing else is allowed.
- `save_draft` can move a job straight from found to drafted. Pasted jobs (PR-23) are scored and drafted in one call.
- Verified by hand: the built `mcp.cjs`, run as Node over a throwaway database, answers `initialize`, lists the six tools, and returns scoped jobs.

## Known risks
- The MCP handshake is checked against the spec's message shapes in tests. A real Claude Code run is a manual check.

## Test plan
- AC-1: `tools.test.ts` lists the tool names; `server.test.ts` runs `tools/list` over a stream.
- AC-2: Per-tool tests with invalid input (wrong types, out-of-range score, unknown keys) return a readable error, not a crash.
- AC-3: `tools.test.ts` saves a draft with an unknown fact ID.
- AC-4: `tools.test.ts`: `get_profile` output has no settings or secret keys; `get_jobs` returns only scoped jobs; writes to an unscoped job are refused.
- AC-5: `server.test.ts` speaks only over the given streams; `mcp-config.test.ts` asserts a stdio command with no URL or port.
- MNB-1: `tools.test.ts` measures the serialized definitions.
- MNB-2: `api-engine.test.ts` runs a tool-use turn through the same tools and returns their result.

## Out of scope
- Sending, form filling and PDF rendering (app-side, later PRs).
- The prompts that use these tools (PR-16, PR-17).
