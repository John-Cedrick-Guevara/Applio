## Feature goal
Fix a bug found reviewing PR-5 (#83): switching between the Scan sources and Paste a job tabs unmounted the other tab, so a running scan's progress view (and a half-pasted post) vanished and the Scan form came back as if nothing was running.

## Acceptance criteria
- [x] AC-1: While a scan runs, switching to Paste a job and back still shows "Scan in progress" with its phases and Stop button.
- [x] AC-2: Both tabs stay mounted; only the active one is visible, and only it is exposed to assistive tech.

## Must not break
- MNB-1: `/get-jobs` and `/get-jobs/paste` still open on the right tab and redirect from the old paths.
- MNB-2: Scans still start only on Start scan, and Paste still checks before adding.

## Known risks
- Both pages load their data when Get jobs opens (sources, status, settings): two small reads instead of one per tab.

## Test plan
- AC-1: `get-jobs-page.test.tsx` › "keeps a running scan on screen while the operator looks at the other tab" (failed before the fix).
- AC-2: same test (the inactive tabpanel is `hidden`).
- MNB-1: `get-jobs-page.test.tsx` › "opens on Scan sources and switches to Paste a job", "opens on Paste a job from its link"; `app.test.tsx` › "redirects Find jobs and Add job to Get jobs".
- MNB-2: existing `find-jobs-page.test.tsx` and `add-job-page.test.tsx`.

## Out of scope
- Showing scan progress outside Get jobs (the activity bar already does).
