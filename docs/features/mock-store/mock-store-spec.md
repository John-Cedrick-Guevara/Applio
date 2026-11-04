## Feature goal
Give the UI and the Electron shell a working backend before Stage 2 exists: an in-memory store that enforces the same rules the real one will, seeded with the prototype's data (SPEC §2–§4).

## Acceptance criteria
- [ ] AC-1: The mock store enforces the same rules as the real backend will: approving an email/ATS draft sends it (status applied, sentBy recorded), approving a platform draft stops at approved, approving a non-drafted job is rejected, disallowed status moves are rejected.
- [ ] AC-2: Secrets set through the store are reported only as set/not set and never appear in any returned value.
- [ ] AC-3: Seed data covers every screen: four drafts across email, ATS and platform channels, sent applications in every status, scored-below-threshold and skipped jobs, and every closed application has a sent date.

## Must not break
- MNB-1: Returned objects are copies; mutating a result never changes the store.

## Known risks
- The mock store becomes a second source of truth; drift from the real backend is caught only if the contract tests stay shared.
- Seed data uses placeholder names (`[Your Name]`, `[Previous Company]`) the operator must replace.

## Test plan
- AC-1: `mock-api.test.ts` — approve on email vs platform, approve when not drafted, disallowed setStatus.
- AC-2: `mock-api.test.ts` — set a secret, stringify `getSettings()` and assert the value is absent.
- AC-3: `mock-api.test.ts` seed-data tests (closed applications have a sent date, drafts on email/ATS/platform); every later page PR renders against this data.
- MNB-1: `mock-api.test.ts` — mutate a returned job, re-read it.

## Out of scope
- Persistence and real services (Stage 2).
