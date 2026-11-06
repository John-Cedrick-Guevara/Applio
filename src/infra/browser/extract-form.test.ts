import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { planFill, type FillInput } from '../../core/apply/ats-plan';
import { extractForm } from './extract-form';

/** Loads a saved apply page (recorded from the live board, trimmed to its form) into the test DOM. */
const page = (name: string) => {
  document.documentElement.innerHTML = readFileSync(join(__dirname, 'fixtures', `${name}.html`), 'utf8');
  return extractForm(document);
};

const input: FillInput = {
  applicant: { fullName: 'Sam Rivera', email: 'sam@gmail.com' },
  files: { resume: '/out/resume.pdf', coverLetter: '/out/cover-letter.pdf' },
  letter: 'Dear team',
  answers: [{ question: 'Phone', answer: '+63 917 555 0100' }, { question: 'LinkedIn profile', answer: 'https://linkedin.com/in/sam' }],
};
const filled = (name: string) => {
  const plan = planFill(page(name).fields, input);
  return { plan, labels: plan.steps.map((s) => `${s.action}:${s.label.slice(0, 20)}`) };
};

describe('reading real ATS forms', () => {
  it('finds the submit button and no CAPTCHA challenge on a freshly loaded form', () => {
    for (const name of ['lever', 'greenhouse', 'ashby', 'workable']) {
      const form = page(name);
      expect(form.submit, name).toBeDefined();
      expect(form.captcha, name).toBe(false);
    }
  });

  it('Greenhouse: fills name, email, phone, LinkedIn and both files; hands over the required custom questions', () => {
    const { plan, labels } = filled('greenhouse');
    expect(labels).toEqual(expect.arrayContaining(['type:First Name', 'type:Last Name', 'type:Email', 'type:Phone', 'type:LinkedIn Profile']));
    expect(plan.steps.filter((s) => s.action === 'file').map((s) => s.value).sort()).toEqual(['/out/cover-letter.pdf', '/out/resume.pdf']);
    expect(plan.missing).toEqual(expect.arrayContaining([expect.stringMatching(/sponsorship for a visa/)]));
  });

  it('Lever: fills the full name, email, phone and résumé; hands over the required current company', () => {
    const { plan, labels } = filled('lever');
    expect(labels).toEqual(expect.arrayContaining(['type:Full name', 'type:Email', 'type:Phone', 'file:Resume/CV ATTACH RES']));
    expect(plan.missing).toEqual(['Current company']);
  });

  it('Ashby: fills name, email, LinkedIn and résumé; hands over its essay questions', () => {
    const { plan, labels } = filled('ashby');
    expect(labels).toEqual(expect.arrayContaining(['type:Name', 'type:Email', 'type:LinkedIn Profile', 'file:Resume']));
    expect(plan.missing.some((m) => /best engineer/.test(m))).toBe(true);
  });

  it('Workable: never answers its attention check or ticks its privacy consent', () => {
    const { plan } = filled('workable');
    expect(plan.missing).toEqual(expect.arrayContaining([expect.stringMatching(/exact phrase/), expect.stringMatching(/everything in this application is true/)]));
    expect(plan.steps.some((s) => /privacy/i.test(s.label))).toBe(false);
  });

  it('never fills a demographic question on any board', () => {
    for (const name of ['lever', 'greenhouse', 'ashby', 'workable']) {
      const { plan } = filled(name);
      expect(plan.steps.filter((s) => /gender|race|veteran|disabilit|hispanic/i.test(s.label)), name).toEqual([]);
    }
  });

  it('reads a label without its required mark, even after an invisible character', () => {
    document.body.innerHTML = '<form><label for="n">Full name*\u200b</label><input id="n" required><button type="submit">Apply</button></form>';
    expect(extractForm(document).fields[0]).toMatchObject({ label: 'Full name', required: true });
  });

  it('sees a showing CAPTCHA challenge, and ignores an invisible one', () => {
    document.body.innerHTML = '<form><input name="a"><button type="submit">Apply</button><iframe src="https://newassets.hcaptcha.com/captcha/v1/abc"></iframe></form>';
    expect(extractForm(document).captcha).toBe(false); // jsdom has no layout: 0×0, as an invisible challenge is
    vi.spyOn(HTMLIFrameElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 80 } as DOMRect);
    expect(extractForm(document).captcha).toBe(true);
  });
});
