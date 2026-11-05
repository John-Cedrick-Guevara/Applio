## Feature goal
Bring in jobs from free, public sources only, politely, with each source counted against its free limit (SPEC F2, principles 1 and 3). This is part a: the shared machinery and the five public JSON boards. Part b (`job-sources-feeds`) adds RSS, the ATS watchlist, HN and attribution in the UI.

## Acceptance criteria
- [ ] AC-1: Adapters fetch and normalize jobs from RemoteOK, Remotive, Himalayas, Jobicy and Arbeitnow into one job shape: source, external id, company, title, board URL (the link back), apply URL, plain-text description, location, posted date, tags, remote flag, and salary and employment type when given.
- [ ] AC-2: Only enabled sources are polled. Each poll is counted per source per local day in SQLite, and a source at its daily limit is skipped until the next day.
- [ ] AC-3: Requests send a descriptive User-Agent, honor ETag / Last-Modified (a 304 reuses the last body), back off on 429 / 5xx (honoring Retry-After, with jitter, and giving up after 3 tries), and never run more than one request at a time per source.
- [ ] AC-4: A failing source is recorded in the run result and skipped; other sources still complete. A malformed job inside a response is dropped and counted, and the rest are kept.
- [ ] AC-5 (data only; the UI is in part b): every normalized job carries the board's name and its board URL, as RemoteOK, Remotive and Jobicy require.
- [ ] AC-6: No adapter can fetch LinkedIn, Indeed, JobStreet or Upwork pages: the HTTP client refuses any host outside an allowlist.

## Must not break
- MNB-1: Disabled sources are never contacted.
- MNB-2: Tests never hit live endpoints; the test setup makes any real `fetch` fail.
- MNB-3: Existing installs keep their source choices when a new default source (Arbeitnow) is added.

## Decisions (settled with the requester, 2026-11-05)
- Split into 11a / 11b for size. Arbeitnow is included (SPEC F2 lists it).
- Fixtures were recorded from one live read-only GET per board on 2026-11-05, then trimmed to three jobs each.
- Daily poll limits: 4 per board, matching Remotive's "max. 4 times a day" and the 6-hourly schedule (SPEC F2).
- The User-Agent names the app and links its repository. It holds no personal email.

## Known risks
- Boards' terms can change. Each adapter's comment quotes the attribution rule it follows (RemoteOK, Remotive, Jobicy, Arbeitnow).
- Remotive delays jobs by 24 hours (its notice). That's acceptable for a 6-hourly scan.
- The ETag / Last-Modified cache lives in memory, so the first poll after a restart is a full fetch.

## Test plan
- AC-1: `sources.test.ts`, one case per board, each against its recorded fixture.
- AC-2: `run-sources.test.ts`: a disabled source is skipped; a source at its limit is skipped; the next day it resumes (fake clock). `polls.test.ts` covers counting in SQLite.
- AC-3: `polite-http.test.ts` with a fake fetch: User-Agent sent, a 304 reuses the cached body, a 429 waits for Retry-After, a 503 retries then gives up, and two calls to one source never overlap.
- AC-4: `run-sources.test.ts`: one source throws, the others return jobs, and the failure is in the result. `sources.test.ts`: a malformed item is dropped and counted.
- AC-5: `sources.test.ts` asserts the board name and URL on every job.
- AC-6: `polite-http.test.ts`: a request to linkedin.com, indeed.com, jobstreet.com or upwork.com is refused before any fetch.
- MNB-1: `run-sources.test.ts`: a disabled source's adapter is never called.
- MNB-2: `src/test/setup.ts` stubs `fetch` to throw; `polite-http.test.ts` proves the stub is in place.
- MNB-3: `settings-service.test.ts`: an install without Arbeitnow gains it, and its existing sources keep their settings.

## Out of scope
- Dedup and filtering (PR-12). Scheduling and storing jobs (PR-13). RSS, ATS, HN and the attribution UI (PR-11b). JSearch.
