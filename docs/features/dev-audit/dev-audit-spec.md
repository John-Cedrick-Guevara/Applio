## Feature goal
Get `npm audit` to zero findings without downgrading the lint toolchain.

## Problem (2026-11-05)
`npm ci` reported 10 moderate findings, all from one advisory: minimatch < 11.0.1, GHSA-g3hv-75wg-m249 (a regex denial of service via glob patterns). minimatch is pulled in by `eslint`, `@eslint/config-array` and `typescript-eslint`, which all ask for minimatch 10. `npm audit fix --force` would instead have downgraded ESLint and typescript-eslint by a major version.

## Acceptance criteria
- [x] AC-1: `npm audit` reports 0 vulnerabilities.
- [x] AC-2: ESLint, typescript-eslint and the rest of the toolchain stay on their current versions.

## Must not break
- MNB-1: Lint still reports real problems, and still skips ignored paths (`dist`).
- MNB-2: `npm run check` and `npm run build` pass.

## Known risks
- An `overrides` entry puts minimatch 11 under packages that declare `^10`. minimatch 11 is days old. It's used only in dev tooling, which never ships in the app. Remove the override once ESLint and typescript-eslint depend on ^11 themselves.

## Test plan
- AC-1: `npm audit` → "found 0 vulnerabilities"
- AC-2: `git diff package.json` touches only `overrides`
- MNB-1: a probe file with an unused variable gets `no-unused-vars`; `npx eslint dist/electron/preload.cjs` → "File ignored because of a matching ignore pattern"
- MNB-2: local check and build; the CI run on this PR

## Out of scope
- Runtime dependencies: they have no findings.
