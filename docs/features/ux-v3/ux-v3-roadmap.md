# UX v3 + manual scans — Roadmap

Small PRs, in order. Each phase is one reviewable PR (≤ ~1,000 changed lines).
Design reference: Applio UI canvas, row "v3" (https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

PR-1 and PR-2 ship value on their own (stuck drafts fixed, no token spend without a click) and
don't wait on the redesign. The redesign follows frontend-first: UI on mock data, then wiring.

## Fixes and behaviour

- [x] **PR-1 — Never leave a draft stuck on "Saving PDFs"** (#70)  Open pages always see the PDFs land, and saving always ends.
  - _branch:_ `fix/draft-stuck-saving`
  - _PR title:_ `fix(review): never leave a draft stuck on saving pdfs`
  - _why:_ a draft panel opened mid-draft treats the PDFs-saved push as its baseline, never reloads, and spins forever
  - _depends on:_ none
  - [x] `useJobsVersion` compares against the latest version main has pushed (shared across hook instances), not the hook's own first push
  - [x] PDF printing gets a hard deadline; a timeout records the existing "Couldn't save the files" note, so Review shows the failed state with Retry
  - [x] `AppStatus.drafting` carries each job's start time, so Review can show real elapsed time (renderer reads ids as before)
  - [x] tests: regression test that fails on `main` (panel mounted after a push reloads on the next one); print timeout leaves a note and no folder

- [x] **PR-2 — Scans run only when the operator starts one** (#71)  No discovery or AI spend without a click.
  - _branch:_ `feat/manual-scans`
  - _PR title:_ `feat(scan): run job scans only when the operator starts one`
  - _why:_ scheduled scans spend tokens (scoring, drafting, leftover retries) every few hours whether or not the operator wants them
  - _depends on:_ none
  - [x] SPEC F2: discovery is operator-triggered (Run now / tray); drop "every 4–6h, catches up after sleep"
  - [x] `backend.tick` stops calling `scheduler.tick`; replies, no-reply marks and limit warnings keep running each minute
  - [x] remove the due-time logic from `core/jobs/scheduler` (keep the single-flight `runNow`), the wake catch-up in `main/index.ts`, and `nextRunAt` from `AppStatus`
  - [x] remove `discoveryIntervalHours` (defaults, schema, types, mock) and the Settings › Schedule interval picker (launch-at-login stays)
  - [x] scans run as an operator trigger, so Pause only stops auto-sends; Pause copy in Review header and tray says so
  - [x] engine card: "Next run" → "Last scan" time; tray keeps "Run discovery now"
  - [x] tests: tick never starts a scan; Run now still runs and is single-flight; Run now works while auto-send is paused

## Stage 1 — Frontend (mock data)
Build the v3 UI. Review and Add job already run on real data; only Find jobs needs mocks.

- [x] **PR-3 — v3 design foundation and app shell** (#72)  Shared tokens and components every v3 screen uses.
  - _branch:_ `feat/ui-v3-foundation`
  - _PR title:_ `feat(ui): add v3 design tokens, state components and narrow nav`
  - _why:_ the audit fails (sub-12px text, off-grid spacing, two primary colors, 40px targets, no narrow nav) live in shared styles, so fix them once
  - _depends on:_ none
  - [x] tokens: type scale 12/14/16/20/24, 4/8 spacing, one blue primary, shadows < 0.08, 44px control height
  - [x] components: `StatusChip` (icon + words), `Callout` (info/done/needs/failed), `JobStepper` (Found → Sent), `StepList` (done/active/pending rows), `ConfirmDialog` (named entity, Cancel focused, Esc, focus restore)
  - [x] ~~shell: sidebar collapses to a top bar + Menu under 640px~~ dropped: the window's minimum width is 960px; the Find jobs nav entry moved to PR-5
  - [x] existing pages pick up the tokens with no layout change
  - [x] tests: component behaviour (dialog focus/Escape/restore), styles test for the token floor (no font < 12px)

- [x] **PR-4 — v3 Review** (#73)  Queue grouped by next action, one clear state per job.
  - _branch:_ `feat/review-v3`
  - _PR title:_ `feat(ui): rebuild review around job state`
  - _why:_ Review is crowded and its states are unclear; each job should say where it is and what unblocks it
  - _depends on:_ PR-1, PR-3
  - [x] queue groups: Needs you / Drafting / Ready to send / Sent today; ↑ ↓ moves, Enter opens; narrow = list then detail with Back
  - [x] detail: `JobStepper`, one callout per state, fit as a checklist, facts as a text line (no tag pills), segmented doc toggle
  - [x] drafting: `StepList` of real stages only (Claude drafting → Saving PDFs) with elapsed from PR-1's start time; failed state shows Retry
  - [x] questions: submit always clickable, blur-first errors, required marked
  - [x] Skip job goes through `ConfirmDialog`; disabled Approve shows its reason beside it
  - [x] tests: state → panel mapping per status, skip confirm, questions validation, keyboard selection

- [x] **PR-5 — v3 Add job and Find jobs pages** (#74)  Add job shows the whole pipeline; Find jobs page on mock data.
  - _branch:_ `feat/add-find-v3`
  - _PR title:_ `feat(ui): add find jobs page and add job pipeline view`
  - _why:_ with scans manual, the operator needs one place to start a scan and see its cost; Add job should show progress instead of "follow it in Review"
  - _depends on:_ PR-2, PR-3
  - [x] Add job: Paste → Check the match → Draft → Ready stepper; progress stays on the page after Add (real drafting status); "Edit the post" keeps the text
  - [x] Find jobs (`/find-jobs`) on real data: sources, cost, results, budget-stop and at-limit states (no mocks needed; source choice, drafting opt-in and live phases came with their backend in PR-6)
  - [x] Review header "Run now" becomes a link to Find jobs
  - [x] tests: Add job pipeline states, Find jobs validation (no source, budget stop) and result states against the mock

## Stage 2 — Backend

- [x] **PR-6 — Wire Find jobs to real scans** (#75)  Scan options and live progress from main.
  - _branch:_ `feat/scan-options`
  - _PR title:_ `feat(scan): run scans with chosen sources and live progress`
  - _why:_ Find jobs needs per-scan source choice, opt-in drafting and progress that comes from records, not a guess
  - _depends on:_ PR-2, PR-5
  - [x] `runDiscovery({ sourceIds, draft })`, zod-validated over IPC; drafting skipped unless `draft` (strong matches wait in Review)
  - [x] scan phase (fetching / filtering / scoring / drafting) and counts pushed in `AppStatus`
  - [x] Stop scan cancels after the current phase and keeps what was found
  - [x] ~~remove the PR-5 Find jobs mocks~~ nothing to remove: PR-5 shipped on real data
  - [x] Review lists strong matches a scan didn't draft under "Ready to draft"
  - [x] tests: only chosen sources poll; no draft AI call when `draft` is false; phases push in order; stop keeps results
