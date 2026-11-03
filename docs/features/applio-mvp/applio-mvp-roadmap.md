# Applio MVP — Roadmap

Small PRs, in order. Each phase is one reviewable PR. Source of truth: [SPEC.md](../../../SPEC.md).

**Every PR starts with a spec.** Before writing code, run `/spec-feature` to create
`docs/features/<slug>/<slug>-spec.md`, where `<slug>` is the branch name without its type prefix
(`feat/review-queue` → `docs/features/review-queue/review-queue-spec.md`). The spec ships in the
same PR and is what the review checks against. See CLAUDE.md §6.

## Stage 1 — Frontend (mock data)

The UI is already built on `feat/renderer-ui` and follows the prototype
(https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T). These PRs re-slice that branch's final code into
stacked, reviewable pieces, each based on the one before. No real backend: data comes from the
in-memory mock in `src/shared/mock/`.

- [ ] **PR-1 — Toolchain and domain contract**  Project tooling, shared types, API contract, domain rules and the mock store.
  - _branch:_ `feat/domain-contract`
  - _PR title:_ `feat: add toolchain, domain contract and mock store`
  - _why:_ every later PR builds on one typed API surface and the same rules the real backend will enforce
  - _depends on:_ none
  - [ ] spec: `docs/features/domain-contract/domain-contract-spec.md`
  - [ ] package.json, tsconfigs, Vite/Vitest/ESLint configs, `.gitignore`, test setup
  - [ ] `src/shared/types.ts`, `src/shared/api.ts` (incl. `API_METHODS`), `src/shared/ipc.ts`
  - [ ] rules: `autonomy.ts`, `quota.ts`, `status.ts`
  - [ ] mock store: `src/shared/mock/` (fixtures, analyze, mock-api)
  - [ ] tests for the above

- [ ] **PR-2 — Electron shell**  Desktop window, locked-down preload bridge, IPC handlers.
  - _branch:_ `feat/electron-shell`
  - _PR title:_ `feat: add electron main process and preload bridge`
  - _why:_ Applio is a local desktop app; the renderer must only reach main through an allow-listed API
  - _depends on:_ PR-1
  - [ ] spec: `docs/features/electron-shell/electron-shell-spec.md`
  - [ ] `src/main/` (index, ipc, security, backend over the mock store), `src/preload/`
  - [ ] `vite.electron.config.ts`, `scripts/dev.mjs`, `dev` / `build` scripts
  - [ ] tests: `security.test.ts`

- [ ] **PR-3 — App shell and design system**  Renderer entry, routing, sidebar, tokens and shared components.
  - _branch:_ `feat/app-shell`
  - _PR title:_ `feat: add renderer shell and prototype design system`
  - _why:_ pages need one frame, one look and one way to load data and report errors
  - _depends on:_ PR-2
  - [ ] spec: `docs/features/app-shell/app-shell-spec.md`
  - [ ] `index.html`, `main.tsx`, `app.tsx`, `routes.ts` (empty route table), `lib/router.ts`, `lib/format.ts`, `lib/labels.ts`
  - [ ] `api/api-context.tsx`, `hooks/use-async.ts`, `hooks/use-action.ts`
  - [ ] `components/*`, `styles/*` (IBM Plex, tokens), `layout/sidebar.tsx`, `layout/engine-card.tsx`
  - [ ] sidebar shows only nav items whose page exists; each page PR adds its own
  - [ ] tests: router, hooks, components, format

- [ ] **PR-4 — Review queue and manual handoff**  The main daily screen and the platform handoff.
  - _branch:_ `feat/review-queue`
  - _PR title:_ `feat: add review queue and manual handoff`
  - _why:_ reviewing and approving drafts is the core loop (SPEC F5, F6)
  - _depends on:_ PR-3
  - [ ] spec: `docs/features/review-queue/review-queue-spec.md`
  - [ ] `pages/review/*`, `pages/handoff/*`, routes `/review`, `/review/:id`, `/handoff/:id`, nav item
  - [ ] tests: review model, review page, handoff page

- [ ] **PR-5 — Applications log**  Everything sent, its timeline, prep and follow-ups.
  - _branch:_ `feat/applications-log`
  - _PR title:_ `feat: add applications log`
  - _why:_ the operator needs to see exactly what went out and what happened next (SPEC F7)
  - _depends on:_ PR-4
  - [ ] spec: `docs/features/applications-log/applications-log-spec.md`
  - [ ] `pages/applications/*`, route `/applications`, nav item
  - [ ] tests: applications model, applications page

- [ ] **PR-6 — Profile and usage**  Fact bank, answer bank, preferences; usage and free-limit guard.
  - _branch:_ `feat/profile-usage`
  - _PR title:_ `feat: add profile and usage pages`
  - _why:_ the AI may only write from the profile (SPEC F1), and nothing may pass a free limit unseen (F10)
  - _depends on:_ PR-5
  - [ ] spec: `docs/features/profile-usage/profile-usage-spec.md`
  - [ ] `pages/profile/*`, `pages/usage/*`, routes, nav items
  - [ ] tests: preferences model, profile page, usage page

- [ ] **PR-7 — Settings and add job**  Sources, channels, guardrails, folder, connections; paste-a-job flow.
  - _branch:_ `feat/settings-add-job`
  - _PR title:_ `feat: add settings and add-job pages`
  - _why:_ every automation level and limit must be operator-controlled (SPEC F2, F5, F6), and any job can be pasted in
  - _depends on:_ PR-6
  - [ ] spec: `docs/features/settings-add-job/settings-add-job-spec.md`
  - [ ] `pages/settings/*`, `pages/add-job/*`, routes, nav items
  - [ ] tests: guardrails model, settings page, add-job model and page
  - [ ] when merged, the tree matches `feat/renderer-ui`; delete that branch

## Stage 2 — Backend

Wire real data behind the same `ApplioApi`. Each PR replaces part of the mock store in
`src/main/backend.ts`; the last one deletes `src/shared/mock/` from the main process
(browser dev and tests may keep it as a fixture).

- [ ] **PR-8 — Local database**  SQLite file in the app data folder, migrations, repositories.
  - _branch:_ `feat/local-database`
  - _PR title:_ `feat: add sqlite storage and migrations`
  - _why:_ data must survive restarts and stay on the operator's machine (SPEC §2)
  - _depends on:_ PR-7
  - [ ] spec: `docs/features/local-database/local-database-spec.md`
  - [ ] schema + migration runner (jobs, status events, drafts, facts, answers, sources, settings, usage)
  - [ ] repositories in `src/infra/db/`; WAL mode, indexes on dedup key / status / created_at
  - [ ] tests against an in-memory database

- [ ] **PR-9 — IPC validation**  zod schemas for every API method's arguments.
  - _branch:_ `feat/ipc-validation`
  - _PR title:_ `feat: validate ipc arguments in main`
  - _why:_ main is the trust boundary; the `ponytail:` note in `src/main/ipc.ts` tracks this
  - _depends on:_ PR-2
  - [ ] spec: `docs/features/ipc-validation/ipc-validation-spec.md`
  - [ ] schema per method in `src/shared/schemas.ts`, checked in `registerApiHandlers`
  - [ ] tests: valid and invalid payloads per method group

- [ ] **PR-10 — Profile, settings and secrets on disk**  Real profile, sources, settings; secrets in the OS keychain.
  - _branch:_ `feat/profile-store`
  - _PR title:_ `feat: persist profile, settings and secrets`
  - _why:_ first real slice; secrets must never touch SQLite or logs (CLAUDE.md §3)
  - _depends on:_ PR-8, PR-9
  - [ ] spec: `docs/features/profile-store/profile-store-spec.md`
  - [ ] profile/settings/sources API methods backed by repositories
  - [ ] `setSecret` via Electron `safeStorage`; `secretsSet` derived from stored keys
  - [ ] resume import: parse PDF/DOCX into fact-bank suggestions
  - [ ] remove these methods from the mock-backed main backend
  - [ ] tests

- [ ] **PR-11 — Job sources**  Board and ATS adapters behind one `JobSource` interface.
  - _branch:_ `feat/job-sources`
  - _PR title:_ `feat: add job source adapters`
  - _why:_ discovery from free public sources only (SPEC F2, principle 3)
  - _depends on:_ PR-8
  - [ ] spec: `docs/features/job-sources/job-sources-spec.md`
  - [ ] RemoteOK, Remotive, Himalayas, Jobicy, WeWorkRemotely (RSS), ATS watchlist (Greenhouse/Lever/Ashby/Workable), HN via Algolia
  - [ ] polite polling: ETag, backoff, per-source poll counts for quotas
  - [ ] tests against recorded fixtures (no live calls)

- [ ] **PR-12 — Triage**  Dedup, free prefilter and blocklist before any AI call.
  - _branch:_ `feat/triage`
  - _PR title:_ `feat: add dedup and free prefilter`
  - _why:_ drop 80–90% of jobs for free (SPEC F3, principle 5)
  - _depends on:_ PR-11
  - [ ] spec: `docs/features/triage/triage-spec.md`
  - [ ] pure `core/triage`: dedup key (company + normalized title + apply URL), prefilter by preferences, blocklist
  - [ ] drop counts per reason recorded for the run summary
  - [ ] tests for every filter branch

- [ ] **PR-13 — Scheduler and automation state**  Runs every 4–6h with catch-up; pause/resume; tray.
  - _branch:_ `feat/scheduler`
  - _PR title:_ `feat: schedule discovery runs`
  - _why:_ discovery must run on its own and catch up after sleep (SPEC F2)
  - _depends on:_ PR-12
  - [ ] spec: `docs/features/scheduler/scheduler-spec.md`
  - [ ] real `runDiscovery`, `getStatus`, `setAutomationPaused`; run summaries stored
  - [ ] tray mode and launch at login
  - [ ] status pushed to the renderer (replaces the engine card's refresh-on-navigation)
  - [ ] tests with a fake clock

- [ ] **PR-14 — AI engine and budget guard**  Headless Claude Code with API-key fallback; token accounting.
  - _branch:_ `feat/ai-engine`
  - _PR title:_ `feat: add ai engine with token budget guard`
  - _why:_ one interface for both engines, and AI pauses at the budget hard stop (SPEC §2, F10)
  - _depends on:_ PR-10
  - [ ] spec: `docs/features/ai-engine/ai-engine-spec.md`
  - [ ] `claude -p --output-format stream-json --strict-mcp-config` runner; Anthropic API fallback with the saved key
  - [ ] usage recorded per run / job / step; hard stop at 100% of the daily or monthly budget
  - [ ] tests with a fake engine

- [ ] **PR-15 — MCP server**  The six tools Claude may call.
  - _branch:_ `feat/mcp-server`
  - _PR title:_ `feat: add local mcp server`
  - _why:_ Claude reads the profile and writes results only through these tools (SPEC §4)
  - _depends on:_ PR-14
  - [ ] spec: `docs/features/mcp-server/mcp-server-spec.md`
  - [ ] `get_profile`, `get_jobs`, `save_match`, `save_draft`, `get_answers`, `log_event`, inputs validated
  - [ ] tests per tool

- [ ] **PR-16 — Scoring**  Batched AI scoring of jobs that pass the prefilter.
  - _branch:_ `feat/ai-scoring`
  - _PR title:_ `feat: score jobs against the fact bank`
  - _why:_ match score, summaries, strengths and gaps drive the queue (SPEC F3.3)
  - _depends on:_ PR-13, PR-15
  - [ ] spec: `docs/features/ai-scoring/ai-scoring-spec.md`
  - [ ] batched scoring writes score, role/description summary, strengths, gaps
  - [ ] jobs at or above the draft threshold move to generation
  - [ ] tests with a fake engine

- [ ] **PR-17 — Draft generation and output folder**  Tailored resume, cover letter or proposal, answers; PDF and folder.
  - _branch:_ `feat/draft-generation`
  - _PR title:_ `feat: generate drafts and write application folders`
  - _why:_ every draft cites only fact-bank entries and lands in the operator's folder (SPEC F4, F8)
  - _depends on:_ PR-16
  - [ ] spec: `docs/features/draft-generation/draft-generation-spec.md`
  - [ ] drafts with fact citations; answers from the bank first, AI only for new ones
  - [ ] PDF via `printToPDF` from the one ATS template; folder layout and re-link by job ID
  - [ ] real `getDraft`, `updateCoverLetter`, `openJobFolder`
  - [ ] tests: citation check rejects unknown fact IDs

- [ ] **PR-18 — Email apply**  Send approved email applications through Gmail.
  - _branch:_ `feat/email-apply`
  - _PR title:_ `feat: send email applications via gmail`
  - _why:_ first real send channel (SPEC F5 channel 1)
  - _depends on:_ PR-17
  - [ ] spec: `docs/features/email-apply/email-apply-spec.md`
  - [ ] SMTP send with app password; `sent.md` written; double-send guard
  - [ ] real `approveDraft` for email, `markApplied`, `skipJob`, `testConnection('gmail')`
  - [ ] Gmail daily cap enforced
  - [ ] tests with a fake SMTP transport

- [ ] **PR-19 — ATS apply**  Fill and submit standard ATS forms in the app's own window.
  - _branch:_ `feat/ats-apply`
  - _PR title:_ `feat: submit standard ats forms`
  - _why:_ second autonomous-capable channel (SPEC F5 channel 2)
  - _depends on:_ PR-18
  - [ ] spec: `docs/features/ats-apply/ats-apply-spec.md`
  - [ ] Greenhouse, Lever, Ashby, Workable fillers; CAPTCHA pauses and hands off
  - [ ] tests against saved form fixtures

- [ ] **PR-20 — Autonomous sending**  Send without approval where source, channel and guardrails allow.
  - _branch:_ `feat/autonomous-send`
  - _PR title:_ `feat: send autonomously within guardrails`
  - _why:_ the Autonomous level (SPEC F6), only on email and ATS, above the auto-send score, under daily caps
  - _depends on:_ PR-19
  - [ ] spec: `docs/features/autonomous-send/autonomous-send-spec.md`
  - [ ] gate: source autonomy, channel ceiling, score, per-channel cap, blocklist, cross-source dedup
  - [ ] tests for every gate

- [ ] **PR-21 — Reply tracking and follow-ups**  IMAP watcher, status updates, follow-ups, interview prep.
  - _branch:_ `feat/reply-tracking`
  - _PR title:_ `feat: track replies and draft follow-ups`
  - _why:_ the application log updates itself (SPEC F7)
  - _depends on:_ PR-18
  - [ ] spec: `docs/features/reply-tracking/reply-tracking-spec.md`
  - [ ] IMAP matches replies to applications; real `sendFollowUp`, `getInterviewPrep`, `setStatus`
  - [ ] tests with a fake mailbox

- [ ] **PR-22 — Telegram notifications**  Alerts and one-tap approvals.
  - _branch:_ `feat/telegram-notify`
  - _PR title:_ `feat: add telegram notifications`
  - _why:_ approve drafts and see replies away from the desk (SPEC F9)
  - _depends on:_ PR-20, PR-21
  - [ ] spec: `docs/features/telegram-notify/telegram-notify-spec.md`
  - [ ] long-polling bot; new matches, drafts with Approve / Open / Skip, replies, follow-ups due, quota warnings
  - [ ] real `testConnection('telegram')`
  - [ ] tests with a fake bot API

- [ ] **PR-23 — Add job and assisted fill**  Real paste/link analysis; optional platform pre-fill.
  - _branch:_ `feat/add-job-live`
  - _PR title:_ `feat: analyze pasted jobs and add assisted fill`
  - _why:_ jobs from anywhere enter the pipeline (SPEC F2 Clip), and platform forms can be pre-filled, never submitted (F5 channel 3)
  - _depends on:_ PR-17
  - [ ] spec: `docs/features/add-job-live/add-job-live-spec.md`
  - [ ] real `analyzeJob` / `addJob` via the AI engine
  - [ ] assisted fill in the operator's signed-in session; operator clicks Submit
  - [ ] tests

- [ ] **PR-24 — Real usage and mock removal**  Usage dashboard from recorded data; mock store out of main.
  - _branch:_ `feat/usage-live`
  - _PR title:_ `feat: report real usage and remove the mock backend`
  - _why:_ the free-limit guard must show real numbers (SPEC F10); nothing in the app should run on fake data
  - _depends on:_ PR-14, PR-22, PR-23
  - [ ] spec: `docs/features/usage-live/usage-live-spec.md`
  - [ ] real `getUsage` (tiles, guard table, steps, 7-day chart)
  - [ ] delete the mock spread from `src/main/backend.ts`; keep `src/shared/mock/` for browser dev and tests only
  - [ ] tests
