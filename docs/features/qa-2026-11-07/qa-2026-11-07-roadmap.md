# QA 2026-11-07 fixes: roadmap

Source: [QA report](../../qa/2026-11-07-qa-report.md). 18 issues (1 blocker, 9 major, 8 minor), grouped into 8 PRs by shared root cause.

## Why the suite missed them

| Gap | Issues | Fix (lands in) |
|---|---|---|
| Renderer tests run on a mock API that only played the happy path (approve always reached `applied`) | #1, #12 | Mock follows the backend's send rules: refuses without Gmail, can refuse a send (`sendFailure`), keeps a send log (PR 1) |
| UI states guessed from status, not read from records ("Sent" when status ≠ drafted; fixed "Every claim traced" badge; "Connected" when a secret is saved) | #1, #2, #8, #10 | State comes from the record, with a negative test per state (PR 1, 2, 6) |
| No check for template placeholders in shipped text | #2, #3 | ESLint `no-restricted-syntax` rule on `[Your Name]`-style literals (PR 1) |
| No invariant that every status is visible somewhere | #1 | `job-lists.test.ts` over `JOB_STATUSES` (PR 1) |
| Triage tests use synthetic titles | #4, #6 | Fixture of real titles/locations from the QA DB, with expected drop reasons (PR 3) |
| Backend journeys only on the happy path | #1, #8 | Failure-path journeys in `backend.test.ts` with a refusing fake SMTP (PR 1, 2) |

## PRs

- [x] **PR 1** `fix/send-integrity` — `fix(apply): show sends as they happened, never as hoped` — #1, #2, #3, #11, #12 (+ #16 folder path). Why: a failed send read as "Sent" and dropped out of every list.
- [x] **PR 2** `fix/send-guardrails` — `fix(apply): gate suspicious posts and verify Gmail before trusting it` — #7, #8. Why: a planted post could auto-send; unverified credentials showed Connected.
- [x] **PR 3** `fix/triage-precision` — `fix(triage): drop out-of-reach roles and near-duplicates before AI` — #4, #6, #14. Why: most tokens went on Senior/US-only jobs; "Labs" duplicates got through.
- [x] **PR 4** `fix/structured-preferences` — `fix(profile): make every filter editable and pay unambiguous` — #9. Depends on PR 3 (seniority rule).
- [x] **PR 5** `fix/review-below-threshold` — `feat(ui): open, draft or dismiss below-threshold jobs` — #5.
- [x] **PR 6** `fix/draft-provenance` — `fix(generation): flag stale drafts and trace the cover letter` — #10.
- [x] **PR 7** `fix/ui-polish` — `fix(ui): clear status, counts and toasts across pages` — #13, #16, #17, #18, plus from #4/#14: drop counts per reason on Usage, and Run now disabled when every source is at its limit.
- [x] **PR 8** `fix/source-quality` — `fix(sources): validate HN fields and Remote OK tags` — #15. Remote OK apply-link resolution deferred: it needs a per-job request design under polite polling.

## Defaults settled (2026-11-07)
- Location rule skips when the operator's country can't be read.
- Jobs paid in another currency are kept and counted on the usage page, not converted.
- Cover-letter fact IDs per paragraph are accepted (small output-token cost).
- Guiding rule from the operator: no state may leave them unsure what happened. Every send, verification or trace claim shown in the UI is read from a record.
