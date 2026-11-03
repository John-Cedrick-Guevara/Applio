## Feature goal
Bring in jobs from free, public sources only, politely, with each source counted against its free limit (SPEC F2, principles 1 and 3).

## Acceptance criteria
- [ ] AC-1: Adapters fetch and normalize jobs from RemoteOK, Remotive, Himalayas, Jobicy, WeWorkRemotely (RSS), the ATS watchlist (Greenhouse, Lever, Ashby, Workable boards for listed companies) and HN Who's Hiring (Algolia), into one job shape with source, company, title, URL, description, posted date and apply URL.
- [ ] AC-2: Only enabled sources are polled; each poll is counted for the usage guard, and a source at its daily limit is skipped until the next day.
- [ ] AC-3: Requests send a descriptive User-Agent, honor ETag / Last-Modified where offered, back off on 429/5xx, and never run more than one request at a time per source.
- [ ] AC-4: A failing source is recorded and skipped; other sources still complete.
- [ ] AC-5: Required attribution for each board is shown on jobs from it.
- [ ] AC-6: No adapter fetches LinkedIn, Indeed, JobStreet or Upwork pages.

## Must not break
- MNB-1: Disabled sources are never contacted.
- MNB-2: Tests never hit live endpoints.

## Known risks
- Each board's free-tier terms and rate limits need confirming (SPEC §6 risks).
- HN thread parsing needs AI to extract jobs; this PR fetches the thread, PR-16 parses it.

## Test plan
- AC-1: Adapter tests per source against recorded fixtures.
- AC-2: Test with a fake clock: disabled source skipped, limit reached → skipped, next day resumes.
- AC-3: Tests with a fake HTTP server: ETag sent, 304 handled, 429 backs off, concurrency 1.
- AC-4: Test with one source throwing; others return jobs and the failure is recorded.
- AC-5: Fixture-based test asserts attribution text per board; manual UI check.
- AC-6: Test asserts adapter base URLs against an allowlist.
- MNB-1: Test asserts no request for a disabled source.
- MNB-2: Test setup blocks real network.

## Out of scope
- Dedup and filtering (PR-12); scheduling (PR-13); JSearch (optional, later).
