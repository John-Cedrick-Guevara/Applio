## Feature goal
Fix a draft added from Add job sitting on "Saving the résumé and letter PDFs…" forever in Review (reported 2026-11-08). Roadmap: `docs/features/ux-v3/ux-v3-roadmap.md` PR-1.

Root cause: `useJobsVersion` treated the first status push each hook saw as its baseline and never reloaded on it. A draft panel mounts when the draft lands (saved by Claude's MCP process mid-turn); the next push is the one sent when the PDFs are saved, so the panel swallowed it, never re-read `folderPath`, and nothing pushed again.

## Acceptance criteria
- [x] AC-1: A page that mounts after main has pushed a version reloads on the next push with a different version, including the first push it receives.
- [x] AC-2: Printing a draft's PDFs gives up after 60 s and records the usual "Couldn't save the files: …" note, so Review shows the failed state with Retry instead of an endless spinner.
- [x] AC-3: Status pushes say when each job in `drafting` started (`draftingSince`), so a later PR can show real elapsed time.

## Must not break
- MNB-1: A push whose version didn't move causes no reload.
- MNB-2: A print that finishes in time saves the files as before.
- MNB-3: `drafting` keeps its shape (list of job ids).

## Test plan
- AC-1: `use-jobs-version.test.ts` › "reloads on the first change after mount when an earlier push already set the version" (fails on `main`).
- MNB-1: `use-jobs-version.test.ts` › "does not reload when the version has not moved"; `applications-page.test.tsx` › "reloads when main reports a job changed in the background…".
- AC-2: `deadline.test.ts` › "rejects with the given message when the work outlasts the deadline"; the note path: `backend.test.ts` › "keeps the draft and notes why when the files cannot be written".
- MNB-2: `deadline.test.ts` › "passes the result through when the work finishes in time"; `backend.test.ts` › "writes the résumé and letter PDFs and job.md into the month folder…".
- AC-3, MNB-3: `backend.test.ts` › "adds a pasted post at once and drafts it in the background…".

## Out of scope
- Destroying a hung print window early (marked `ponytail:` in `backend.ts`).
- Showing elapsed time in Review (PR-4).
