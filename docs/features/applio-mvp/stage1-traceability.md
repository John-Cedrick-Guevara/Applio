# Stage 1 — Traceability to the original specs

The seven Stage 1 specs were written before the PRs were built. Building them pushed three PRs past
the ~1,000-line limit, so the work ended up in 13 PRs (1a–7b) and the specs were split to match.
This table checks every criterion of the **original** seven specs, worded as first written,
against the final stack (`feat/add-job`). The "Proof" column says how each is shown. Every row is met; the native file dialogs were
checked by hand by the requester (see the last section).

Proof types: **test** = automated (`npm run check`), **built app** = checked in the packaged
Electron app over the DevTools protocol, **browser** = checked in `npm run dev:web`,
**faked OS** = unit test with a faked `electron` module, **by hand** = run in the built app by the requester.

## domain-contract (original) → PR-1a, PR-1b

| Item | Where | Proof |
|---|---|---|
| AC-1 check and `vite build` pass | 1a (check), 2 onward (build) | test; `npm run build` at every branch tip from PR-2 |
| AC-2 `API_METHODS` complete, no duplicates | 1a | test (`ipc.test.ts`); removing an entry breaks typecheck (verified by hand) |
| AC-3 autonomy capped by channel | 1a | test (`autonomy.test.ts`) |
| AC-4 quota levels | 1a | test (`quota.test.ts`) |
| AC-5 status flow | 1a | test (`status.test.ts`) |
| AC-6 mock enforces real rules | 1b | test (`mock-api.test.ts`) |
| AC-7 secrets write-only | 1b | test (`mock-api.test.ts`) |
| AC-8 readable errors, IPC prefix stripped | 1a | test (`ipc.test.ts`); built app shows "Job j7 is not awaiting approval" |
| AC-9 seed data covers every screen | 1b | test (seed-data cases); browser pass through all screens |
| MNB-1 results are copies | 1b | test |
| MNB-2 shared compiles without DOM or Node | 1a | `tsc -p tsconfig.node.json` and renderer tsconfig in `npm run check` |

## electron-shell (original) → PR-2

| Item | Where | Proof |
|---|---|---|
| AC-1 dev window with live reload; build + start | 2 | built app (`npm start`) loads; live reload verified by editing `sidebar.tsx` and reading the change inside Electron |
| AC-2 isolation, sandbox, no Node in page | 2 | built app: `typeof require`/`process` are `undefined` |
| AC-3 bridge exposes exactly `API_METHODS` | 2 | built app: method count equals `API_METHODS`, `listJobs()` returns data |
| AC-4 untrusted frames rejected | 2 | test (`isAppUrl`) |
| AC-5 readable error in page, detail logged in main | 2 | built app + main log `[ipc] approveDraft failed` |
| AC-6 links leave the app, never a new window | 2 | built app: a real mouse click on an external `target=_blank` link made the default browser request it (seen in a local server's log), the app stayed on its page with one window; `window.open` returns `null`. Plus test (`denyAndOpenExternally`, `guardNavigation`) |
| AC-7 only http(s) reaches the OS | 2 | test (`isSafeExternalUrl`, `backend.test.ts`); built app refuses `file:///etc/passwd` |
| AC-8 native pickers; cancel isn't an error | 2 | faked OS (`backend.test.ts`: folder and resume, chosen and cancelled; folder paths, OS errors). plus by hand in the built app — see below |
| MNB-1 `dev:web` still works | 2 onward | browser |
| MNB-2 preload requires only `electron` | 2 | inspected `dist/electron/preload.cjs` |

## app-shell (original) → PR-3a, PR-3b (+ page PRs for nav items, PR-7a for switches)

| Item | Where | Proof |
|---|---|---|
| AC-1 prototype design, fonts bundled (offline) | 3b | browser (IBM Plex loaded); production CSS references only local `.woff2`/`.woff`, no remote URLs |
| AC-2 sidebar: logo, Add job, nav with icons, active item incl. nested paths | 3b, nav items added by 4a–7a | browser (`#/review/j2` keeps Review active; each page's item active) |
| AC-3 engine card | 3b | browser (Ready, next run, tokens; Paused after pausing) |
| AC-4 hash routes, back/forward, unknown → default, lazy | 3a (router), 3b (redirect) | test (`router.test.ts`); browser back/forward and `#/no-such-page` → `#/review` |
| AC-5 skeleton, error + Retry, data kept on refresh | 3b | test (`components.test.tsx`) |
| AC-6 failure toast + console log | 3a | test (`use-action.test.tsx`) |
| AC-7 stale responses ignored | 3a | test (`use-async.test.ts`) |
| AC-8 375px: top bar, no horizontal scroll | 3b | browser (`scrollWidth <= innerWidth`) |
| AC-9 keyboard focus ring; switches are `role="switch"` | 3b (focus), 7a (switch) | browser Tab check; test (`components.test.tsx` Toggle) |
| MNB-1 renderer never imports main/Node | 3a onward | lint/tsc with renderer tsconfig |
| MNB-2 strict CSP | 2 onward | `index.html` meta; no CSP errors in console |

## review-queue (original) → PR-4a, PR-4b, PR-4c

| Item | Where | Proof |
|---|---|---|
| AC-1 queue, best first, chips, states | 4a | test (`review-page.test.tsx`, `review-model.test.ts`) |
| AC-2 selection beside queue, in URL | 4b | test (opens with id); browser back/forward |
| AC-3 draft header, fit, gaps | 4b | test |
| AC-4 letter / resume / post tabs | 4b | test |
| AC-5 edit, save, "Edited by you", cancel | 4b | test; browser Cancel |
| AC-6 approve email/ATS sends and confirms | 4b | test |
| AC-7 platform → Open handoff | 4b | test |
| AC-8 skip dims and selects next | 4b | test (`app.test.tsx`, written red first; fixed a remount bug) |
| AC-9 run line, Run now, pause | 4a | test; browser Run now |
| AC-10 handoff steps | 4c | test (`handoff-page.test.tsx`) |
| AC-11 copy, "Copied", toast; clipboard refused | 4c | test; browser with clipboard refused |
| AC-12 Mark as applied / I didn't apply | 4c | test |
| AC-13 empty state | 4a | browser (skipped every draft) |
| MNB-1 platform never sent from Review | 4a, 4b | test (`review-model.test.ts`) |
| MNB-2 sidebar count matches | 4a | browser (count falls as drafts are handled) |

## applications-log (original) → PR-5

| Item | Where | Proof |
|---|---|---|
| AC-1 – AC-8 | 5 | test (`applications-page.test.tsx`, `applications-model.test.ts`); AC-6 also browser |
| AC-9 open folder, disabled without one | 5 (UI), 2 (OS) | faked OS (`openJobFolder`); button `disabled` when `folderPath` is empty |
| MNB-1 follow-up only on Send | 5 | test (history unchanged after editing, changed after Send) |
| MNB-2 drafts and skipped excluded | 5 | test |

## profile-usage (original) → PR-6a, PR-6b

| Item | Where | Proof |
|---|---|---|
| AC-1 resume card, Replace, cancel | 6a (UI), 2 (OS) | faked OS (`importResume` chosen and cancelled); browser; by hand (native picker) |
| AC-2 – AC-7 | 6a | test (`profile-page.test.tsx`, `preferences-model.test.ts`); browser Cancel for AC-3 and AC-6 |
| AC-8 – AC-10 | 6b | test (`usage-page.test.tsx`); browser visual |
| MNB-1 deleting a fact leaves drafts | 6a | test (`mock-api.test.ts`) |
| MNB-2 usage page read-only | 6b | no write calls in `pages/usage` (checked by grep) |

## settings-add-job (original) → PR-7a, PR-7b

| Item | Where | Proof |
|---|---|---|
| AC-1 – AC-5, AC-7 | 7a | test (`settings-page.test.tsx`, `guardrails-model.test.ts`); browser Escape and duplicate for AC-5 |
| AC-6 output folder picker and Open | 7a (UI), 2 (OS) | faked OS (`chooseFolder` chosen and cancelled); by hand (native picker) |
| AC-8 Gmail/Telegram setup → Connected | 7a | test (missing credentials); browser (address + app password → "Connected") |
| AC-9 – AC-11 | 7b | test (`add-job-model.test.ts`, `add-job-page.test.tsx`); browser Discard and Add another |
| MNB-1 secrets never shown | 7a | test; browser (`document.body` lacks the saved value) |
| MNB-2 platform/career sites never autonomous | 1a, 7a | test (`autonomy.test.ts`); ChannelsSection offers only assisted fill for them |

## Native file dialogs — checked by hand

This environment can't operate macOS dialogs (synthetic keystrokes and screen capture are
refused), so the requester ran the built app (`npm run build && npm start`) and confirmed the
pickers work: Settings → Change… cancelled and chosen, Profile → Replace cancelled. This closes
electron-shell AC-8, profile AC-1 and settings AC-6 alongside their faked-OS unit tests.

## Found in that pass

The same pass showed a layout bug on long pages (Settings): a second window scrollbar and the
sidebar background ending after the first screen. Fixed in PR-3b (`fix(ui): stop hidden labels
from stretching the window`) with a regression test in `styles.test.ts`.
