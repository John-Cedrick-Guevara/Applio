# Redesign v2 — Roadmap

One PR per screen, in order. Each PR is spec'd, built, reviewed against its spec and merged
before the next one starts. Design reference: Applio UI canvas, row "Redesign v2"
(https://claude.ai/artifact/3T4Bs69qQWvxy9xKiND79T).

Mostly frontend on data the API already has. The two gaps that need main-process work
(score one job, duplicate check before AI) are their own small PRs at the end, so no
screen waits on them.

## The gate (every PR, in this order)

A PR merges only when every step passes. A failed step goes back to build, not forward to merge.

1. **Spec first.** `/spec-feature` → `docs/features/<slug>/<slug>-spec.md` (`<slug>` = branch
   without its type prefix). Every `AC-n` maps to a test-plan line; `MNB-n` lists what must not break.
   Settle open questions before coding.
2. **Build test-first.** Each `AC-n` has a test that failed before the code (CLAUDE.md §5).
3. **Local check green.** `npm run check` (typecheck, lint, tests) and `npm run build`.
4. **Run it.** Drive the real flow headlessly on a copy of the operator DB (never the live one):
   the screen's happy path, its empty state, a failure state, and the keyboard path.
   Screenshot each for the PR body.
5. **Review against the spec.** `/review-pr`: Pass 0 grades every `AC-n` / `MNB-n` as met or not,
   with evidence (test name or screenshot); then logic, stress, security, data, deployment passes.
   Any fail → fix on the same branch → re-review. Merge only on "approved" or "approved with notes"
   whose notes are logged under the PR here.
6. **Merge, then tick** this roadmap's box in the next PR (or a `docs:` commit).

Every PR's spec carries these must-not-break items:
- No send without the operator's click, except auto-send on email/ATS at or above the auto-send score (SPEC F6).
- "Sent" shows only when a sent record exists (QA 2026-11-07 #1).
- No token spend without a click, and every spending button shows its cost (SPEC F2, F10).
- No job is reachable in no list (QA 2026-11-07 #1 AC-4).

## Stage 1 — Screens (frontend, real data)

- [x] **PR-1 — Job state card and one lifecycle** (#78)  Every job says where it is, why, and what moves it on, in one card.
  - _branch:_ `feat/job-state-card`
  - _PR title:_ `feat(ui): add job state card and one five-stage lifecycle`
  - _why:_ draft warnings stack with no priority and three steppers use three vocabularies; one card and one stepper fix both everywhere
  - _depends on:_ none
  - _canvas:_ 4 · Job state card, 6 · Lifecycle and words
  - [ ] `jobState(job, { draft, send, questions, drafting, budgetStop })` → one state from the priority ladder (not sent > check post > questions > PDFs failed > older profile > drafting > budget used > ready > sent), plus the folded "more notes"
  - [ ] `nextLine(job, source, settings)`: the "What happens next" sentence from autonomy, channel cap and auto-send score
  - [ ] `JobStateCard` component (title, one sentence, primary + secondary, cost aside) and `Stepper` relabelled New → Matched → Drafted → Ready → Sent
  - [ ] Review's draft panel and job panel use them in place of the stacked banners; Add job's stepper uses the same five words
  - [ ] vocabulary in `labels.ts`: Skip (not Dismiss), Draft bar, Auto-send at, Hand off, Not sent
  - [ ] tests: one per ladder rung, ties resolve by priority, Sent only with a sent record, next line per autonomy/channel

- [x] **PR-2 — Activity bar** (#79)  Running work, auto-send and budget visible on every page.
  - _branch:_ `feat/activity-bar`
  - _PR title:_ `feat(ui): replace the engine card with an activity bar`
  - _why:_ scans and drafts are invisible once you leave the page that started them, and "will it send on its own?" has no answer on screen
  - _depends on:_ none
  - _canvas:_ 5 · Activity bar
  - [ ] bar above every page from `AppStatus` pushes: scan phase + elapsed + Stop, drafting count, last scan
  - [ ] auto-send state in words with Pause/Resume (moves out of the Review header)
  - [ ] budget meter: blue < 80%, amber ≥ 80%, red at the hard stop; signed-out engine state
  - [ ] opened panel: what's running with links, budget line with Raise budget
  - [ ] remove `EngineCard` and the Review header pause button
  - [ ] tests: each of the 7 states from a status fixture; Stop calls `stopScan`; pause round-trip

- [x] **PR-3 — Matches** (#80)  One list for jobs with no draft yet, with the draft bar beside it.
  - _branch:_ `feat/matches`
  - _PR title:_ `feat(ui): add matches list with draft bar and bulk draft`
  - _why:_ undrafted, below-bar and unscored jobs hide in Review footers; sorting them needs its own list
  - _depends on:_ PR-1
  - _canvas:_ 2 · Matches
  - [ ] `/matches`: tabs At or above bar / Below bar / Not scored / All, search, "New since last scan" (found at or after `lastRun.at`)
  - [ ] draft bar slider saves `draftThreshold` via `saveSettings`; counts update live
  - [ ] row Draft (cost shown) and Skip; bulk select → Draft n / Skip n; Draft n disabled over today's remaining budget, with the reason beside it
  - [ ] unscored rows say "Your next scan scores it" (Score now comes in PR-6)
  - [ ] skip is held ~5 s with Undo, then `skipJob` (skipped is terminal in `status.ts`)
  - [ ] filtered-empty with Clear all filters; first-use empty with Get jobs
  - [ ] nav entry with "n new"; Review keeps its footers until PR-4 so nothing is unreachable in between
  - [ ] tests: bucket per score vs bar, budget cap blocks bulk draft, undo cancels the skip call, new-since-scan filter

- [ ] **PR-4 — Inbox**  Only decisions, one tab at a time, worked through in order.
  - _branch:_ `feat/inbox`
  - _PR title:_ `feat(ui): turn review into an inbox of decisions`
  - _why:_ Review mixes decisions with sorting and gets cluttered at volume; the badge disagrees with the list
  - _depends on:_ PR-1, PR-3
  - _canvas:_ 1 · Inbox
  - [ ] `/inbox` (`/review` and `/review/:id` redirect); default route
  - [ ] tabs Fix first (not sent + suspicious) / Answer / Approve / Hand off with counts; opens on the first non-empty, most urgent tab
  - [ ] one-line rows, label only for exceptions, list scrolls in its own frame; sort best match / oldest
  - [ ] detail = stepper + `JobStateCard` + next line + folded role and fit; "n of m in Approve"
  - [ ] open the next job after each decision (toggle); keys ↑ ↓, A approve, S skip on the list
  - [ ] Undo only for Skip (held ~5 s); Approve shows a plain confirmation, no Undo (it has already sent)
  - [ ] sidebar badge = Inbox count exactly; tab-empty state points to the next non-empty tab
  - [ ] remove Review's undrafted / below-bar / not-scored footers (now in Matches)
  - [ ] tests: tab membership per job state, badge equals list, auto-advance order, A blocked on handoff, approve has no undo, no job in neither Inbox nor Matches nor Applications
  - [ ] split up front: 4a `feat/inbox` (route, tabs, rows, badge, drafting list) and 4b `feat/inbox-flow` (approve-and-next, keys, undo), each reviewed and merged on its own

- [ ] **PR-5 — Get jobs**  One place to bring jobs in: scan sources or paste a post.
  - _branch:_ `feat/get-jobs`
  - _PR title:_ `feat(ui): merge find jobs and add job into get jobs`
  - _why:_ two pages for one outcome, each explaining cost differently; the scan result lands on whatever is first in Review
  - _depends on:_ PR-3
  - _canvas:_ 3 · Get jobs
  - [ ] `/get-jobs` with Scan sources / Paste a job tabs (`/find-jobs`, `/add-job` redirect); sidebar Get jobs button
  - [ ] per-source poll usage and the at-limit row disabled with its reason
  - [ ] shared cost panel: free steps, scoring, drafting, share of today's remaining budget; budget-cap note when drafting is on
  - [ ] scan result → "Open the n new matches" opens Matches filtered to new since this scan
  - [ ] paste: existing analyze → add flow; duplicate shown as a warning with Open it (copy doesn't claim "free" until PR-7)
  - [ ] remove the old Find jobs and Add job pages
  - [ ] tests: cost share per option, no-source and budget-stop blocks, result link carries the filter, duplicate state

## Stage 2 — Backend gaps

- [ ] **PR-6 — Score one job now**  Unscored matches get a Score button instead of waiting for a scan.
  - _branch:_ `feat/score-now`
  - _PR title:_ `feat(triage): score a single found job on request`
  - _why:_ scans are manual, so an unscored job otherwise waits for a scan the operator may not run
  - _depends on:_ PR-3
  - [ ] `scoreJob(jobId)` over IPC (zod-validated), through the quota guard, records token usage
  - [ ] Matches "Score · ≈ 2k" on unscored rows, and bulk select scores them
  - [ ] tests: quota hard stop blocks it, usage recorded, only `found` jobs accepted

- [ ] **PR-7 — Duplicate check before AI on paste**  A pasted job you already have costs no tokens.
  - _branch:_ `feat/paste-dedup-first`
  - _PR title:_ `feat(jobs): check pasted jobs for duplicates before analysis`
  - _why:_ `analyzeJob` finds duplicates only after Claude reads the post (QA 2026-11-07 #6)
  - _depends on:_ PR-5
  - [ ] cheap company + title extraction (page metadata or the post's first lines) → `findByDedupKey` before the AI call
  - [ ] duplicate returns without an AI call; Get jobs copy says "checked for free"
  - [ ] tests: duplicate post makes zero AI calls; an unreadable post falls through to analysis
