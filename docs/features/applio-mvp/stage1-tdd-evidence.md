# Stage 1 — Red-first evidence

CLAUDE.md §5 asks that each PR's tests demand its code. For every Stage 1 PR, its new or changed
test files (with the PR's own test setup) were run against the **previous PR's code**, then
against the PR itself. Reproduce with the worktree script described at the bottom.

| PR | Branch | Before (previous PR's code) | Why it failed | After |
|---|---|---|---|---|
| 1a | `feat/domain-contract` | 4 test files fail | modules under test don't exist yet | 16 pass |
| 1b | `feat/mock-store` | 1 test file fails | `mock-api` doesn't exist yet | 21 pass |
| 2 | `feat/electron-shell` | 2 test files fail | `security` / `backend` don't exist yet | 12 pass |
| 3a | `feat/renderer-core` | 4 test files fail | router, format, hooks, toast don't exist yet | 17 pass |
| 3b | `feat/app-shell` | 1 test file fails | `AsyncView` doesn't exist yet | 3 pass |
| 4a | `feat/review-queue` | 2 test files fail | review model and page don't exist yet | 9 pass |
| 4b | `feat/draft-review` | **6 tests fail, 2 pass** | assertions: no draft detail, and the page remounted on selection (the routing bug, test written red first) | 8 pass |
| 4c | `feat/manual-handoff` | 1 test file fails | handoff page doesn't exist yet | 4 pass |
| 5 | `feat/applications-log` | 2 test files fail | applications model and page don't exist yet | 11 pass |
| 6a | `feat/profile` | 2 of 3 test files fail | profile modules don't exist yet; the added `mock-api` case passes before and after (it guards existing behavior: drafts survive fact deletion) | 32 pass |
| 6b | `feat/usage-limits` | 1 test file fails | usage page doesn't exist yet | 4 pass |
| 7a | `feat/settings` | 3 test files fail | switch, guardrails and settings modules don't exist yet | 16 pass |
| 7b | `feat/add-job` | 2 test files fail | add-job modules don't exist yet | 6 pass |

## Honest limits

- For new modules the "before" failure is the module being absent, which CLAUDE.md §5 counts as
  a weaker red than a failing assertion. Assertion-level reds were observed while the UI was first
  built test-first on `feat/renderer-ui` (tests written and run red before each page), but the
  re-sliced PRs carry test and code in the same commit, as §5 allows.
- Must-not-break tests that pin existing behavior (6a) pass before and after by design.

## Reproduce

For each consecutive pair of branches in the stack: check out the earlier one in a scratch
worktree, copy in the later branch's changed `*.test.ts(x)` files plus `vitest.config.ts` and
`src/test/*`, run `npx vitest run <those files>`, then check out the later branch and run them again.
