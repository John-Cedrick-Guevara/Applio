## Feature goal
Pasting a job post that names no company fails with a generic "Try again" and leaves no record on disk. After the fix, such a post is scored with the company shown as "Unknown company"; when an analysis does fail, the operator is told the real reason and whether retrying can help, and every failed IPC call leaves a line in a log file in the app's data folder.

## Acceptance criteria
- [ ] AC-1: Claude's answer with `company: null` (or empty) is accepted and the job's company is "Unknown company"; title and score are still required.
- [ ] AC-2: An analysis refused for a missing or empty title (not a merely too-long one, which can be retried) tells the operator the post has no recognisable job title and to paste the whole post; it does not say "Try again".
- [ ] AC-3: An analysis refused because Claude's answer wasn't JSON, or had no usable score, says Claude's answer couldn't be used and that trying Analyze again is reasonable.
- [ ] AC-4: Every failed API call, including one rejected for coming from an untrusted sender, appends one line to `applio.log` in the app's data folder with time, method, error code and message, and the cause when there is one.
- [ ] AC-5: The log line never contains argument values (pasted posts, keys, addresses), only their count.
- [ ] AC-6: The log file stops growing without bound: past 1 MB it is rotated to `applio.log.1`, replacing any older one.
- [ ] AC-7: A failure to write the log never changes what the operator sees or hides the original error.

## Must not break
- MNB-1: An analysis with no title or no numeric score is still refused, and the error's cause names the failing fields, not their values.
- MNB-2: The renderer still receives only the operator-readable message, not the cause or stack.
- MNB-3: Invalid-argument rejections and untrusted-sender rejections are still refused with the same messages, and an untrusted call never reaches the backend.

## Known risks
- Two anonymous posts with the same title share the dedup key "Unknown company" + title and read as duplicates; accepted by the author.
- The log holds error causes from adapters; causes must not carry secrets. Existing causes name fields or exit codes only.

## Test plan
- AC-1: `analyze-job.test.ts` "keeps a post that names no company, as 'Unknown company'" (null), plus an empty-string case.
- AC-2: `analyze-job.test.ts` asserts the title-missing message mentions the title and does not contain "Try again".
- AC-2, AC-3: `analyze-job.test.ts` "does not blame a missing title when the title is merely too long"; asserts a prose answer and a non-numeric score give the "try Analyze again" message.
- AC-4: `error-log.test.ts` appends an entry to a temp file and reads the line back; `ipc.test.ts` shows a failing handler and an untrusted sender both call the log.
- AC-5: `ipc.test.ts` calls a failing method with a secret-looking argument and asserts the logged line lacks it.
- AC-6: `error-log.test.ts` pre-fills a file over 1 MB and asserts rotation to `.1` and a fresh file.
- AC-7: `error-log.test.ts` / `ipc.test.ts` with an unwritable path: the handler still throws the original message.
- MNB-1: existing "refuses an answer that cannot be read, or that has no title or score" test plus a cause assertion naming fields only.
- MNB-2: `ipc.test.ts` asserts the thrown error's message equals the operator message.
- MNB-3: existing invalid-argument cases stay green; `ipc.test.ts` "logs an untrusted sender to the file, without running the call".

## Out of scope
- A log viewer or "open log" button in the UI.
- Letting the operator type a missing company and re-run.
- Logging non-IPC failures (scheduler, Telegram, replies) to the file; they keep using the console.
