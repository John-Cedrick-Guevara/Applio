## Feature goal
Treat the main process as the trust boundary: every API call from the page is checked before it reaches any service (CLAUDE.md §2–3).

## Acceptance criteria
- [ ] AC-1: Every method in `API_METHODS` has an argument schema; a call whose arguments don't match is rejected with a readable message and never reaches the backend.
- [ ] AC-2: Strings are length-limited, ids are non-empty, numbers are finite and in range, enums accept only known values.
- [ ] AC-3: Rejections are logged in main with the method name and the validation issue, without logging argument values that could hold secrets.
- [ ] AC-4: A test fails if a method is added to `API_METHODS` without a schema.

## Must not break
- MNB-1: Every call the UI makes today still succeeds.
- MNB-2: `setSecret` values are never logged.

## Known risks
- Schemas duplicate TypeScript types; keep them next to the types in `src/shared` so they change together.

## Test plan
- AC-1: Per-method-group tests: valid payload passes, wrong type / missing field rejected.
- AC-2: Boundary tests: overlong string, empty id, NaN, out-of-range score, unknown enum.
- AC-3: Test spies on the logger and asserts method + issue, no value.
- AC-4: Test iterates `API_METHODS` and checks each has a schema.
- MNB-1: Full renderer test suite plus a manual click-through in Electron.
- MNB-2: Test calls `setSecret` with a bad payload and asserts the secret isn't in logs.

## Out of scope
- Validating responses from external APIs (in each adapter PR).
