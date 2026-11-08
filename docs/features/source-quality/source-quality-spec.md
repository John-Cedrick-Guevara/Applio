## Feature goal
Source data is clean enough to filter and dedup on (QA 2026-11-07 #15). HN fields are checked before they're trusted, and Remote OK's SEO tags no longer pose as the job's stack.

## Acceptance criteria
- AC-1: An HN company never holds a web address ("Distru (https://www.distru.com)" → "Distru"), and must be 2–60 characters with letters.
- AC-2: An HN location that runs into the post is cut at the glued sentence ("Reno, NVWe build…" → "Reno, NV"), at the first sentence end, and at 80 characters on a word boundary.
- AC-3: A post whose first line isn't "Company | Role | …" gets "Unknown company" and "See post", and an empty location, for the AI to fill from the full text.
- AC-4: Remote OK tags the post never mentions are dropped.

## Must not break
- MNB-1: Recorded HN and Remote OK fixtures parse as before (company, role, remote flag, encoding repair).

## Test plan
- AC-1: `feeds.test.ts` › "keeps a web address out of the company name"
- AC-2: `feeds.test.ts` › "cuts a location that runs on into the post…"
- AC-3: `feeds.test.ts` › "leaves company and role to the AI when the post doesn't follow the Company | Role line"
- AC-4: `sources.test.ts` › "drop Remote OK tags that the post never mentions…"
- MNB-1: existing `feeds.test.ts`, `sources.test.ts`

## Out of scope
- Resolving Remote OK's apply redirect to the company's own URL. It needs one extra request per job at fetch time, so it needs its own design under the polite-polling rules (CLAUDE.md §4). Until then, Remote OK jobs stay a career-site handoff.
