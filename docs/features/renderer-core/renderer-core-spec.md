## Feature goal
Give every page one way to route, load data and report failures, so screens behave consistently and errors are never silent (CLAUDE.md §3 errors; prototype toast behavior).

## Acceptance criteria
- [ ] AC-1: Routes live in the URL hash: static paths match, `:param` segments are extracted and URL-decoded, a trailing slash is ignored, and mismatches return no match.
- [ ] AC-2: The renderer uses the preload bridge (`window.applio`) when present, and otherwise the in-memory mock with a console warning, so it runs in a plain browser.
- [ ] AC-3: A failed action shows a toast "Couldn't <action>. <reason>" and logs full detail to the console; a successful action can show a confirmation toast.
- [ ] AC-4: A slower earlier request never overwrites the result of a newer one; loaders expose loading, error, reload and local updates (including updater functions).
- [ ] AC-5: Tokens, relative times, clock times and short dates are formatted as in the prototype (e.g. 1.3k, 150k, 3.4M; "5m ago"; "08:00"; "Oct 29").
- [ ] AC-6: Toasts are announced to screen readers (live region) and errors can be dismissed.

## Must not break
- MNB-1: The renderer never imports from `src/main` or Node built-ins.

## Known risks
- No page uses these yet; they are exercised by the app shell (PR-3b) and every page PR.

## Test plan
- AC-1: `router.test.ts` — static, params, decoding, trailing slash, mismatch.
- AC-2: Code review of `resolveApi`; manual: `npm run dev:web` shows the mock warning (exercised from PR-3b, which renders the app).
- AC-3: `use-action.test.tsx` — success toast, failure toast text, console log.
- AC-4: `use-async.test.ts` — loading then data, error, reload, updater, superseded request ignored.
- AC-5: `format.test.ts`.
- AC-6: `use-action.test.tsx` renders toasts inside the `role="status"` region; code review of the dismiss button.
- MNB-1: ESLint/tsc with the renderer tsconfig (no Node types).

## Out of scope
- Styles, components and the app frame (PR-3b).
