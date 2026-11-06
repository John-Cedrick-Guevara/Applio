import { describe, expect, it } from 'vitest';
import { looksSubmitted } from './confirmation';

const form = { url: 'https://jobs.lever.co/acme/1/apply', text: 'Apply for this job. Submit application' };

describe('looksSubmitted', () => {
  it('sees a thank-you message that appeared after Submit', () => {
    expect(looksSubmitted(form, { url: form.url, text: 'Thank you for applying! We will be in touch.' })).toBe(true);
  });

  it('sees a move to a confirmation page', () => {
    expect(looksSubmitted(form, { url: 'https://jobs.lever.co/acme/1/thanks', text: '' })).toBe(true);
  });

  it('ignores thank-you wording the form page already had, so a failed submit is never taken as sent', () => {
    const page = { url: form.url, text: 'Thank you for your interest in Acme. Apply below.' };
    expect(looksSubmitted(page, { url: page.url, text: 'Thank you for your interest in Acme. Apply below. Email is required.' })).toBe(false);
  });

  it('ignores a confirmation-looking URL that was already the form page', () => {
    const page = { url: 'https://acme.com/careers/confirm-interest', text: '' };
    expect(looksSubmitted(page, { url: page.url, text: '' })).toBe(false);
  });
});
