/**
 * The one email check the Settings field and main's IPC validation share, so
 * an address the page accepts is never rejected on save. It's a shape check
 * only; Gmail sign-in is the real test.
 */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
