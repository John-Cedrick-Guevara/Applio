## Feature goal
Give every later PR one typed API surface and one set of domain rules, so the UI and the future backend build on the same contract (SPEC §2–§4).

## Acceptance criteria
- [ ] AC-1: `npm run check` (typecheck for browser and Node configs, lint, tests) passes on a clean install.
- [ ] AC-2: `ApplioApi` declares every operation the UI needs, and `API_METHODS` lists each method exactly once; adding a method to the interface without listing it fails typecheck.
- [ ] AC-3: Autonomy is capped by channel: email and ATS may be autonomous; platform and career-site channels never exceed Draft → Approve, and a source's own level is never raised.
- [ ] AC-4: A quota reads OK below its warning fraction, Warning at or above it, and Stopped at or above its limit; a zero limit reads Stopped.
- [ ] AC-5: Manual status moves follow the flow in SPEC F7 (e.g. drafted → approved/skipped, applied → replied/interview/rejected/ghosted); terminal statuses allow no moves.
- [ ] AC-6: Rejected calls carry an operator-readable message; Electron's "Error invoking remote method" prefix is stripped by `unwrapIpcError`.

## Must not break
- MNB-1: The shared folder has no DOM or Node-only imports, so it compiles for both renderer and main.

## Known risks
- Rules here are enforced again by the mock store (PR-1b) and later by the real backend; keep the rule modules the single source.

## Test plan
- AC-1: `npm ci && npm run check`.
- AC-2: `ipc.test.ts` asserts no duplicates; the `API_METHODS_COMPLETE` constant fails typecheck if a method is missing (verify once by deleting an entry).
- AC-3: `autonomy.test.ts` — every channel × level, including "never raises".
- AC-4: `quota.test.ts` — below, at and above the warning fraction, at and over the limit, zero limit.
- AC-5: `status.test.ts` — drafted, applied, interview and terminal statuses.
- AC-6: `ipc.test.ts` — prefixed and plain messages.
- MNB-1: `tsc -p tsconfig.node.json` (no DOM lib) and the renderer tsconfig both compile `src/shared`.

## Out of scope
- The mock store (PR-1b).
- Any UI, Electron code or persistence.
- Runtime validation of arguments (PR-9).
