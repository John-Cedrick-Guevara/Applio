const DONE_URL = /thank|confirm|success|submitted|application-received/i;
const DONE_TEXT = /thank(s| you) for (applying|your (application|interest))|application (was |has been )?(received|submitted)|we('ve| have) received your application/i;

/**
 * Whether an ATS form went through: the page moved to a confirmation URL, or a
 * thank-you message appeared. Wording the form page already had before Submit
 * doesn't count, so a submit that failed validation is never taken as sent.
 * ponytail: common wording and URLs; add per-ATS signals if a board's confirmation goes unnoticed.
 */
export function looksSubmitted(before: { url: string; text: string }, now: { url: string; text: string }): boolean {
  if (now.url !== before.url && DONE_URL.test(now.url)) return true;
  return DONE_TEXT.test(now.text) && !DONE_TEXT.test(before.text);
}
