# Applio MVP — Roadmap

Small PRs, in order. Each phase is one reviewable PR. PRs 1, 3, 4, 6 and 7 are split into lettered parts so each stays within the ~1,000-line limit. Source of truth: [SPEC.md](../../../SPEC.md).

**Every PR starts with a spec.** Before writing code, run `/spec-feature` to create
`docs/features/<slug>/<slug>-spec.md`, where `<slug>` is the branch name without its type prefix
(`feat/review-queue` → `docs/features/review-queue/review-queue-spec.md`). The spec ships in the
same PR and is what the review checks against. See CLAUDE.md §6.

**Where we are:** Stage 1 is on `main` (#15), and CI runs on every PR (#16). Stage 2: PR-8 to PR-12 are merged (#17–#19, #23–#25); fixes from the first manual run are in #20–#22. PR-13 (scheduler), PR-14 (AI engine) and PR-15 (MCP server) are in review as a stack. Next is PR-16 (scoring).

## Stage 1 — Frontend (mock data)

The UI is already built on `feat/renderer-ui` and follows the prototype
(https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T). These PRs re-slice that branch's final code into
stacked, reviewable pieces (components and styles land with the page that first uses them), each based on the one before. No real backend: data comes from the
in-memory mock in `src/shared/mock/`.

- [x] **PR-1a — Toolchain and domain contract**  Project tooling, shared types, API contract and domain rules.
  - _branch:_ `feat/domain-contract`
  - _PR title:_ `feat: add toolchain and domain contract`
  - _why:_ every later PR builds on one typed API surface and the same rules the real backend will enforce
  - _depends on:_ none
  - [x] spec: `docs/features/domain-contract/domain-contract-spec.md`
  - [x] package.json, tsconfigs, Vitest/ESLint configs
  - [x] `src/shared/types.ts`, `api.ts` (incl. `API_METHODS`), `ipc.ts`; rules: `autonomy.ts`, `quota.ts`, `status.ts`
  - [x] tests for the above

- [x] **PR-1b — Mock store**  In-memory backend with prototype seed data.
  - _branch:_ `feat/mock-store`
  - _PR title:_ `feat: add in-memory mock store`
  - _why:_ the UI and Electron shell need a backend that enforces the real rules before Stage 2 exists
  - _depends on:_ PR-1a
  - [x] spec: `docs/features/mock-store/mock-store-spec.md`
  - [x] `src/shared/mock/` (fixtures, analyze, mock-api) and tests

- [x] **PR-2 — Electron shell**  Desktop window, locked-down preload bridge, IPC handlers.
  - _branch:_ `feat/electron-shell`
  - _PR title:_ `feat: add electron main process and preload bridge`
  - _why:_ Applio is a local desktop app; the renderer must only reach main through an allow-listed API
  - _depends on:_ PR-1b
  - [x] spec: `docs/features/electron-shell/electron-shell-spec.md`
  - [x] `src/main/` (index, ipc, security, backend over the mock store), `src/preload/`
  - [x] `vite.electron.config.ts`, `scripts/dev.mjs`, `dev` / `build` scripts
  - [x] tests: `security.test.ts`, window guards, OS integration in `backend.test.ts`

- [x] **PR-3a — Renderer core**  React toolchain, router, API context, data and action hooks, toasts.
  - _branch:_ `feat/renderer-core`
  - _PR title:_ `feat: add renderer core`
  - _why:_ every page loads data, routes and reports errors the same way
  - _depends on:_ PR-2
  - [x] spec: `docs/features/renderer-core/renderer-core-spec.md`
  - [x] React/Testing Library/fonts deps, Vite/Vitest/ESLint for React, test setup
  - [x] `lib/router.ts`, `lib/format.ts`, `api/api-context.tsx`, `hooks/*`, `components/toast.tsx`
  - [x] tests: router, format, hooks

- [x] **PR-3b — App shell and design system**  Prototype tokens, base components, app frame and sidebar.
  - _branch:_ `feat/app-shell`
  - _PR title:_ `feat: add app shell and prototype design system`
  - _why:_ pages need one frame and one look
  - _depends on:_ PR-3a
  - [x] spec: `docs/features/app-shell/app-shell-spec.md`
  - [x] `styles/*`, button, icons, states, AsyncView; `index.html`, `main.tsx`, `app.tsx`, `routes.ts`, sidebar, engine card
  - [x] tests: components

- [x] **PR-4a — Review queue**  Drafts waiting on the operator, run summary, pause and run now.
  - _branch:_ `feat/review-queue`
  - _PR title:_ `feat: add review queue`
  - _why:_ reviewing drafts is the core loop (SPEC F5, F6)
  - _depends on:_ PR-3b
  - [x] spec: `docs/features/review-queue/review-queue-spec.md`
  - [x] review model, labels, `review-page`, `review-header`, `review-queue`, routes `/review`, `/review/:id`, nav item
  - [x] tests: review model, queue and header

- [x] **PR-4b — Draft review**  The selected draft: fit, documents, editing, approve or hand off.
  - _branch:_ `feat/draft-review`
  - _PR title:_ `feat: add draft review and approval`
  - _why:_ nothing is sent that the operator didn't see (SPEC F4, F5)
  - _depends on:_ PR-4a
  - [x] spec: `docs/features/draft-review/draft-review-spec.md`
  - [x] `draft-panel`, `draft-document`, score block; keep pages mounted when only route params change
  - [x] tests: draft detail, approve, edit, skip

- [x] **PR-4c — Manual handoff**  The walkthrough for channels Applio never submits on.
  - _branch:_ `feat/manual-handoff`
  - _PR title:_ `feat: add manual handoff`
  - _why:_ platform and career-site jobs must stay operator-submitted (SPEC F5, principle 3)
  - _depends on:_ PR-4b
  - [x] spec: `docs/features/manual-handoff/manual-handoff-spec.md`
  - [x] `pages/handoff/*`, route `/handoff/:id`, copy button
  - [x] tests: handoff page

- [x] **PR-5 — Applications log**  Everything sent, its timeline, prep and follow-ups.
  - _branch:_ `feat/applications-log`
  - _PR title:_ `feat: add applications log`
  - _why:_ the operator needs to see exactly what went out and what happened next (SPEC F7)
  - _depends on:_ PR-4c
  - [x] spec: `docs/features/applications-log/applications-log-spec.md`
  - [x] `pages/applications/*`, route `/applications`, nav item
  - [x] tests: applications model, applications page

- [x] **PR-6a — Profile**  Reference resume, preferences, fact bank, answer bank.
  - _branch:_ `feat/profile`
  - _PR title:_ `feat: add profile page`
  - _why:_ the AI may only write from the profile (SPEC F1)
  - _depends on:_ PR-5
  - [x] spec: `docs/features/profile/profile-spec.md`
  - [x] `pages/profile/*`, page header, route, nav item
  - [x] tests: preferences model, profile page, drafts survive fact deletion

- [x] **PR-6b — Usage and limits**  Spend against every free limit.
  - _branch:_ `feat/usage-limits`
  - _PR title:_ `feat: add usage and limits page`
  - _why:_ nothing may pass a free limit unseen (SPEC F10)
  - _depends on:_ PR-6a
  - [x] spec: `docs/features/usage-limits/usage-limits-spec.md`
  - [x] `pages/usage/*`, route, nav item
  - [x] tests: usage page

- [x] **PR-7a — Settings**  Sources, channels, guardrails, folder, connections.
  - _branch:_ `feat/settings`
  - _PR title:_ `feat: add settings page`
  - _why:_ every automation level and limit must be operator-controlled (SPEC F2, F5, F6, F8)
  - _depends on:_ PR-6b
  - [x] spec: `docs/features/settings/settings-spec.md`
  - [x] `pages/settings/*`, switch and card components, route, nav item
  - [x] tests: guardrails model, settings page, switch

- [x] **PR-7b — Add job**  Paste a job from anywhere and queue it.
  - _branch:_ `feat/add-job`
  - _PR title:_ `feat: add paste-a-job flow`
  - _why:_ jobs found anywhere must be able to enter the pipeline (SPEC F2 Clip)
  - _depends on:_ PR-7a
  - [x] spec: `docs/features/add-job/add-job-spec.md`
  - [x] `pages/add-job/*`, route
  - [x] tests: add-job model and page
  - [x] when merged, `main` matches `feat/renderer-ui` (plus fixes and tests); delete that branch (checked in #19's review: it differs only by code later fixes replaced; the branch is local-only)

## Stage 2 — Backend

Wire real data behind the same `ApplioApi`. Each PR replaces part of the mock store in
`src/main/backend.ts`; the last one deletes `src/shared/mock/` from the main process
(browser dev and tests may keep it as a fixture).

- [x] **PR-8 — Local database**  SQLite file in the app data folder, migrations, repositories.
  - _branch:_ `feat/local-database`
  - _PR title:_ `feat: add sqlite storage and migrations`
  - _why:_ data must survive restarts and stay on the operator's machine (SPEC §2)
  - _depends on:_ PR-7b
  - [x] spec: `docs/features/local-database/local-database-spec.md`
  - [x] schema + migration runner (jobs, status events, drafts, facts, answers, sources, settings, usage)
  - [x] repositories in `src/infra/db/`; WAL mode, indexes on dedup key / status / created_at
  - [x] tests against an in-memory database
  - _decided:_ `node:sqlite` (no native module); database at `~/Applio/applio.db` with the generated files

- [x] **PR-9 — IPC validation**  zod schemas for every API method's arguments.
  - _branch:_ `feat/ipc-validation`
  - _PR title:_ `feat: validate ipc arguments in main`
  - _why:_ main is the trust boundary; the `ponytail:` note in `src/main/ipc.ts` tracks this
  - _depends on:_ PR-2
  - [x] spec: `docs/features/ipc-validation/ipc-validation-spec.md`
  - [x] schema per method in `src/shared/schemas.ts`, checked in `registerApiHandlers`
  - [x] tests: valid and invalid payloads per method group

- [x] **PR-10 — Profile, settings and secrets on disk**  Real profile, sources, settings; secrets in the OS keychain.
  - _branch:_ `feat/profile-store`
  - _PR title:_ `feat: persist profile, settings and secrets`
  - _why:_ first real slice; secrets must never touch SQLite or logs (CLAUDE.md §3)
  - _depends on:_ PR-8, PR-9
  - [x] spec: `docs/features/profile-store/profile-store-spec.md`
  - [x] profile/settings/sources API methods backed by repositories
  - [x] `setSecret` via Electron `safeStorage`; `secretsSet` derived from stored keys
  - [x] resume import: parse PDF/DOCX into fact-bank suggestions
  - [x] remove these methods from the mock-backed main backend (`testConnection` checks real credentials; the live test comes with the Gmail/Telegram PRs)
  - [x] tests

- [x] **PR-11a — Job sources: polite client and JSON boards**  One `JobSource` interface, a polite HTTP client, the source runner, and the five public JSON boards.
  - _branch:_ `feat/job-sources`
  - _PR title:_ `feat: add job source adapters`
  - _why:_ discovery from free public sources only (SPEC F2, principle 3)
  - _depends on:_ PR-8
  - [x] spec: `docs/features/job-sources/job-sources-spec.md`
  - [x] RemoteOK, Remotive, Himalayas, Jobicy, Arbeitnow
  - [x] polite polling: ETag / Last-Modified, backoff with jitter, one request at a time per source, host allowlist
  - [x] per-source daily poll limits, counted in SQLite; a failing source is recorded and skipped
  - [x] tests against recorded fixtures (no live calls)
  - _decided:_ split from one PR (size); Arbeitnow added (SPEC F2 lists it); fixtures recorded from one live fetch per board

- [x] **PR-11b — Job sources: feeds, ATS watchlist, HN and attribution**  The remaining source types, and board credit shown on jobs.
  - _branch:_ `feat/job-sources-feeds`
  - _PR title:_ `feat: add rss, ats watchlist and hn sources`
  - _why:_ completes SPEC F2's free sources; boards require credit with a link back (AC-5)
  - _depends on:_ PR-11a
  - [x] spec: `docs/features/job-sources-feeds/job-sources-feeds-spec.md`
  - [x] WeWorkRemotely (RSS), ATS watchlist (Greenhouse / Lever / Ashby / Workable; starts empty), HN Who is hiring via Algolia (thread only; PR-16 parses it)
  - [x] attribution text and link on jobs from each board
  - [x] tests against recorded fixtures

- [x] **PR-12 — Triage**  Dedup, free prefilter and blocklist before any AI call.
  - _branch:_ `feat/triage`
  - _PR title:_ `feat: add dedup and free prefilter`
  - _why:_ drop 80–90% of jobs for free (SPEC F3, principle 5)
  - _depends on:_ PR-11b
  - [x] spec: `docs/features/triage/triage-spec.md`
  - _decided:_ role match needs every word of one target role; dedup key is company + normalized title (SPEC F3 updated)
  - [x] pure `core/triage`: dedup key (company + normalized title), prefilter by preferences, blocklist
  - [x] drop counts per reason recorded for the run summary
  - [x] tests for every filter branch

- [x] **PR-13 — Scheduler and automation state**  Runs every 4–6h with catch-up; pause/resume; tray.
  - _branch:_ `feat/scheduler`
  - _PR title:_ `feat: schedule discovery runs`
  - _why:_ discovery must run on its own and catch up after sleep (SPEC F2)
  - _depends on:_ PR-12
  - [x] spec: `docs/features/scheduler/scheduler-spec.md`
  - [x] real `runDiscovery`, `getStatus`, `setAutomationPaused`; run summaries stored
  - [x] tray mode and launch at login
  - [x] status pushed to the renderer (replaces the engine card's refresh-on-navigation)
  - [x] tests with a fake clock
  - _decided:_ interval 4–6h in Settings (default 6); launch at login off by default with a Settings switch; discovery waits until Profile has a target role

- [x] **PR-14 — AI engine and budget guard**  Headless Claude Code with API-key fallback; token accounting.
  - _branch:_ `feat/ai-engine`
  - _PR title:_ `feat: add ai engine with token budget guard`
  - _why:_ one interface for both engines, and AI pauses at the budget hard stop (SPEC §2, F10)
  - _depends on:_ PR-10
  - [x] spec: `docs/features/ai-engine/ai-engine-spec.md`
  - [x] `claude -p --output-format stream-json --strict-mcp-config` runner; Anthropic API fallback with the saved key
  - [x] usage recorded per run / job / step; hard stop at 100% of the daily or monthly budget
  - [x] tests with a fake engine
  - _decided:_ `claude-opus-5-5` for every API step; monthly budget added (default 3M tokens); `@anthropic-ai/sdk` is the one new dependency

- [x] **PR-15 — MCP server**  The six tools Claude may call.
  - _branch:_ `feat/mcp-server`
  - _PR title:_ `feat: add local mcp server`
  - _why:_ Claude reads the profile and writes results only through these tools (SPEC §4)
  - _depends on:_ PR-14
  - [x] spec: `docs/features/mcp-server/mcp-server-spec.md`
  - [x] `get_profile`, `get_jobs`, `save_match`, `save_draft`, `get_answers`, `log_event`, inputs validated
  - [x] tests per tool
  - _decided:_ stdio (Claude Code starts it; nothing else can reach it); hand-written JSON-RPC, no MCP SDK; the API-key engine runs the same tools in-process

- [x] **PR-16 — Scoring**  Batched AI scoring of jobs that pass the prefilter.
  - _branch:_ `feat/ai-scoring`
  - _PR title:_ `feat: score jobs against the fact bank`
  - _why:_ match score, summaries, strengths and gaps drive the queue (SPEC F3.3)
  - _depends on:_ PR-13, PR-15
  - [x] spec: `docs/features/ai-scoring/ai-scoring-spec.md`
  - [x] batched scoring writes score, role/description summary, strengths, gaps
  - [x] jobs at or above the draft threshold move to generation
  - [x] tests with a fake engine
  - _decided:_ batches of 10; only each run's new jobs are scored, with one retry; strengths cite fact IDs; `listJobs` / `getJob` now read SQLite

- [x] **PR-17a — Draft generation**  Tailored resume, cover letter or proposal, answers, every line citing a fact.
  - _branch:_ `feat/draft-generation`
  - _PR title:_ `feat: generate drafts from the fact bank`
  - _why:_ every draft cites only fact-bank entries (SPEC F4, principle 2)
  - _depends on:_ PR-16
  - [x] spec: `docs/features/draft-generation/draft-generation-spec.md`
  - [x] drafts with fact citations; numbers must match the cited fact; answers from the bank first, AI only for new ones
  - [x] real `getDraft`, `updateCoverLetter`
  - [x] tests: citation check rejects unknown fact IDs
  - _decided:_ split from PR-17 (size); one AI call per job right after scoring; Notify-only sources are never drafted

- [x] **PR-17b — Draft files**  One ATS template, PDFs, the output folder, previews from the template.
  - _branch:_ `feat/draft-files`
  - _PR title:_ `feat: write application folders and pdfs`
  - _why:_ every draft lands in the operator's folder as the files that get sent (SPEC F4, F8)
  - _depends on:_ PR-17a
  - [x] spec: `docs/features/draft-files/draft-files-spec.md`
  - [x] PDF via `printToPDF` from the one ATS template; folder layout and re-link by job ID
  - [x] real `openJobFolder`; Review previews from the same template; Open PDF
  - _decided:_ `job.md` front matter holds the job id; a "Name on your documents" setting; `openDraftFile` API method

- [x] **PR-18 — Email apply**  Send approved email applications through Gmail.
  - _branch:_ `feat/email-apply`
  - _PR title:_ `feat: send email applications via gmail`
  - _why:_ first real send channel (SPEC F5 channel 1)
  - _depends on:_ PR-17b
  - [x] spec: `docs/features/email-apply/email-apply-spec.md`
  - [x] SMTP send with app password; `sent.md` written; double-send guard
  - [x] real `approveDraft` for email, `markApplied`, `skipJob`, `testConnection('gmail')`
  - [x] Gmail daily cap enforced
  - [x] tests with a fake SMTP transport
  - _decided:_ `nodemailer` for SMTP; a `sends` table is the double-send guard and the record of what went out; a crash mid-send blocks any resend

- [x] **PR-19 — ATS apply**  Fill and submit standard ATS forms in the app's own window.
  - _branch:_ `feat/ats-apply`
  - _PR title:_ `feat: submit standard ats forms`
  - _why:_ second autonomous-capable channel (SPEC F5 channel 2)
  - _depends on:_ PR-18
  - [x] spec: `docs/features/ats-apply/ats-apply-spec.md`
  - [x] Greenhouse, Lever, Ashby, Workable fillers; CAPTCHA pauses and hands off
  - [x] tests against saved form fixtures
  - _decided:_ one generic reader and planner for all four; only identity, files, letter and matching saved answers are filled; demographics and checkboxes never; unconfirmed submits are never retried

- [x] **PR-20 — Autonomous sending**  Send without approval where source, channel and guardrails allow.
  - _branch:_ `feat/autonomous-send`
  - _PR title:_ `feat: send autonomously within guardrails`
  - _why:_ the Autonomous level (SPEC F6), only on email and ATS, above the auto-send score, under daily caps
  - _depends on:_ PR-19
  - [x] spec: `docs/features/autonomous-send/autonomous-send-spec.md`
  - [x] gate: source autonomy, channel ceiling, score, per-channel cap, blocklist, cross-source dedup
  - [x] tests for every gate
  - _decided:_ held jobs stay drafted in Review with the reason; no extra first-run cap (the per-channel cap bounds it); hidden ATS window for autonomous runs

- [x] **PR-21a — Follow-ups, No reply, prep and status**  The log keeps itself current between replies.
  - _branch:_ `feat/followups`
  - _PR title:_ `feat: send follow-ups and prepare interviews`
  - _why:_ the application log updates itself (SPEC F7)
  - _depends on:_ PR-20
  - [x] spec: `docs/features/follow-ups/follow-ups-spec.md`
  - [x] real `sendFollowUp` (threaded, logged), `getInterviewPrep` (cached), `setStatus`; No reply after 21 days
  - [x] tests with a fake clock and Gmail
  - _decided:_ split from PR-21 (size); every email gets a stored Message-ID; "Correct status" menu in the application detail

- [ ] **PR-21b — Reply tracking**  IMAP watcher matches replies and moves applications on.
  - _branch:_ `feat/reply-tracking`
  - _PR title:_ `feat: track replies in gmail`
  - _why:_ replies move the log without manual work (SPEC F7)
  - _depends on:_ PR-21a
  - [ ] spec: `docs/features/reply-tracking/reply-tracking-spec.md`
  - [ ] IMAP matches replies to applications by thread, domain or company; Replied, Interview, Rejected
  - [ ] tests with a fake mailbox

- [ ] **PR-22 — Telegram notifications**  Alerts and one-tap approvals.
  - _branch:_ `feat/telegram-notify`
  - _PR title:_ `feat: add telegram notifications`
  - _why:_ approve drafts and see replies away from the desk (SPEC F9)
  - _depends on:_ PR-20, PR-21b
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
