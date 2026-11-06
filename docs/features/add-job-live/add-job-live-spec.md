## Feature goal
Let any job the operator finds anywhere enter the pipeline by pasting its post or link (SPEC F2 Clip). Assisted fill on platform forms is PR-23b (`docs/features/assisted-fill/assisted-fill-spec.md`).

## Acceptance criteria
- [x] AC-1: Pasting a job post or link and choosing Analyze reads it with AI (fetching public pages only; platform links use only what the operator pasted), scores it, and shows company, role, tags, summary, detected channel, how Applio will apply and the highest autonomy.
- [x] AC-2: Add to review queue saves the job, drafts it, and it appears in Review.
- [x] AC-3: A pasted job that duplicates an existing one is flagged instead of added twice.

## Must not break
- MNB-1: Applio never scrapes LinkedIn, Indeed, JobStreet, Upwork or Facebook pages on its own.
- MNB-2: A pasted job is never sent without the operator (the Clipped source is capped at Draft → Approve).

## Decisions (defaults picked while building, 2026-11-06; change any in review)
- Split from PR-23 (size). This PR covers analyze and add; PR-23b covers assisted fill and the Upwork Connects line.
- Paste only, no browser extension (the spec's recommendation).
- A link is fetched only when it's a public `https` page off the platform list, read as text (up to 2 MB, 15 s). A LinkedIn, Indeed, JobStreet, Upwork or Facebook link is never fetched: Applio asks for the post's text instead (MNB-1).
- One AI call per analysis (step `score`, operator-triggered, so it runs while paused). Claude reads your fact bank through `get_profile`, then answers with JSON: company, role, location, type, pay, tags, two summaries, the apply email or link it found, a score, strengths citing fact IDs, and gaps. The JSON is checked, and unknown fact IDs fail it.
- The analysis is held in memory under a preview id until you add it or analyze something else. Add takes that id, so what's saved is exactly what was analyzed, not what the page sends back.
- Channel and route: an email in the post means email; a link is read by `detectChannel`; a platform link means platform apply; nothing found means a career site with a manual handoff.
- Duplicates (AC-3): Add refuses a company + title Applio already has, naming the existing one and its status. Analyze already notes it in the route line.
- Add saves the job as Scored, under the Clipped source, then drafts it in the same call as a run would (files included), even while paused. It never sends on its own, because Clipped is capped at Draft → Approve (MNB-2).

## Found in review
- Redirects were followed automatically, so a short link could lead onto a LinkedIn page. Redirects are now followed by hand, at most 5, and every hop is checked against the https and platform rules.

## Known risks
- Platforms may still restrict accounts that use automation (warned in Settings).

## Test plan
- AC-1: `analyze-job.test.ts` with a fake AI: email, ATS, platform and no-route posts; bad JSON and unknown facts refused. `fetch-page.test.ts`: public page read as text; platform hosts never requested; `http` refused. `backend.test.ts` end to end.
- AC-2: `backend.test.ts`: the added job is drafted and listed as drafted.
- AC-3: `backend.test.ts`: adding a duplicate is refused by name.
- MNB-1: `fetch-page.test.ts` and `analyze-job.test.ts`: no request for platform links.
- MNB-2: `backend.test.ts`: the added job stays drafted, with nothing sent.

## Out of scope
- Assisted fill and the Upwork Connects line (PR-23b). A browser extension (paste only, for now).
