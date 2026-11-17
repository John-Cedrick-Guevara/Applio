# Bug journal

Newest first. Each entry: what failed, root cause, the pattern that could bring it back.

## BUG-2026-11-17-analyze-no-company — Pasted post with no company name is refused, and the failure leaves no trace

- **Spec:** docs/fixes/analyze-post-errors/analyze-post-errors-spec.md
- **What failed:** Pasting a job post that never names a company (ReactJS/NodeJS entry-level post) showed "Claude's reading of the post couldn't be used. Try again." Retrying could never work. The only record was a `console.error` line in the terminal that launched the app; nothing was saved to disk, so the operator had no way to tell what went wrong.
- **Root cause:** `AnalysisSchema` required `company` (`z.string().min(1)`); Claude correctly answered `"company": null`, so the whole analysis was refused (`company: invalid_type`). Separately, every refusal used one generic "Try again" message, and failures were logged only to the console.
- **Reproduction:** the real analyze prompt through Claude Code on a DB copy, with the pasted post; raw reply had `"company":null`, all else valid, `score: 20`.
- **Risk pattern:** a field in an AI-output zod schema that is required although the source text may legitimately lack it, with a failure message that tells the operator to retry; and error handlers whose only record is `console.error`.
- **Derived checklist item:** none. The pattern is not checkable from a diff objectively.
