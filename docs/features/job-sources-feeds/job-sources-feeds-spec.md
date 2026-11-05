## Feature goal
Complete SPEC F2's free sources and give each board the credit it asks for. This is part b of PR-11. Part a (`job-sources`) built the `JobSource` interface, the polite client and the JSON boards.

## Acceptance criteria
- [x] AC-1: WeWorkRemotely jobs are read from its public RSS feed into the shared job shape.
- [x] AC-2: The ATS watchlist polls the public board JSON of each listed company on Greenhouse, Lever, Ashby and Workable. The list starts empty, and an empty list makes no requests.
- [x] AC-3: HN "Who is hiring" fetches the current month's thread through the Algolia API. Turning comments into jobs is PR-16's job (AI).
- [x] AC-4: Jobs from a board show that board's attribution text with a link back to the job on it (RemoteOK, Remotive, Jobicy, Arbeitnow, Himalayas, WeWorkRemotely).
- [x] AC-5: The host allowlist grows only by these sources' hosts.

## Must not break
- MNB-1: PR-11a's limits, backoff, failure isolation and allowlist apply to these sources unchanged.
- MNB-2: Tests never hit live endpoints.

## Decisions (settled with the requester, 2026-11-05)
- The ATS watchlist starts empty; an edit UI comes later.
- Fixtures come from one live read-only fetch per endpoint.

## Found while building
- HN's comments are turned into jobs by reading the community's "Company | Role | Place" first line, verbatim. PR-16's AI scoring reads the full post.
- Workable's widget API has no job description. Title, department and function stand in until the job page is read.
- Lever and Ashby return no company name, so the board slug stands in for it.

## Known risks
- Workable's public board endpoint varies by account setup; a company whose board isn't public is reported as failed, not retried.

## Test plan
- AC-1: `sources.test.ts`: the RSS fixture is normalized.
- AC-2: `sources.test.ts`: one fixture per ATS; an empty watchlist makes no request.
- AC-3: `sources.test.ts`: the Algolia fixture gives the thread id and its comments.
- AC-4: page test: a job from each board shows its credit and link; manual check in the app.
- AC-5: `polite-http.test.ts`: the allowlist cases.
- MNB-1, MNB-2: the PR-11a tests run unchanged.

## Out of scope
- Watchlist editing UI. Parsing HN comments (PR-16). JSearch.
