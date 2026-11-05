## Feature goal
Make the main-process build quiet again, so a new warning stands out.

## Problem (2026-11-05)
`npm run build` printed four `[EMPTY_IMPORT_META]` warnings. pdf.js and unpdf (bundled into the CommonJS main build since PR-10) use `import.meta`, which CommonJS doesn't have, so the bundler swapped in `{}` and warned each time.

## Acceptance criteria
- [x] AC-1: `npm run build:electron` prints no `EMPTY_IMPORT_META` warnings.
- [x] AC-2: The replacement is explicit in `vite.electron.config.ts`, with the reason it's safe.

## Must not break
- MNB-1: The bundled résumé reader still reads PDF and DOCX files, and still gives the readable errors for damaged and text-less files.
- MNB-2: `npm run check` and `npm run build` pass.

## Known risks
- `{}` also hides `import.meta` from any future main-process dependency. If one needs `import.meta.url`, the build has to move to ESM or polyfill it. The comment in the config says so.

## Test plan
- AC-1: `npm run build:electron 2>&1 | grep -c EMPTY_IMPORT_META` → 0
- AC-2: review `vite.electron.config.ts`
- MNB-1: bundle `read-resume.ts` with the same options and run it in Electron (`ELECTRON_RUN_AS_NODE=1`) on all four fixtures: the PDF and DOCX read, and the damaged and blank PDFs give their errors
- MNB-2: local check and build; the CI run on this PR

## Out of scope
- Moving the main build to ESM.
