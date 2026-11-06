import { describe, expect, it } from 'vitest';
import type { FormField } from './ats-form';
import { planFill, type FillInput } from './ats-plan';

const field = (label: string, over: Partial<FormField> = {}): FormField => ({ selector: `#${label.replace(/\W+/g, '-')}`, kind: 'text', label, required: true, ...over });

const input: FillInput = {
  applicant: { fullName: 'Sam Rivera', email: 'sam@gmail.com' },
  files: { resume: '/out/acme/resume.pdf', coverLetter: '/out/acme/cover-letter.pdf' },
  letter: 'Dear team,\n\nI build APIs.',
  answers: [
    { question: 'Phone', answer: '+63 917 555 0100' },
    { question: 'LinkedIn profile URL', answer: 'https://linkedin.com/in/sam' },
    { question: 'Are you authorized to work remotely from the Philippines?', answer: 'Yes' },
  ],
};

describe('planFill', () => {
  it('fills the name, email, résumé and cover letter', () => {
    const plan = planFill([field('First Name'), field('Last Name'), field('Email', { kind: 'email' }), field('Resume/CV', { kind: 'file' }), field('Cover letter', { kind: 'textarea', required: false })], input);
    expect(plan.missing).toEqual([]);
    expect(plan.steps).toEqual([
      { selector: '#First-Name', label: 'First Name', action: 'type', value: 'Sam' },
      { selector: '#Last-Name', label: 'Last Name', action: 'type', value: 'Rivera' },
      { selector: '#Email', label: 'Email', action: 'type', value: 'sam@gmail.com' },
      { selector: '#Resume-CV', label: 'Resume/CV', action: 'file', value: '/out/acme/resume.pdf' },
      { selector: '#Cover-letter', label: 'Cover letter', action: 'type', value: 'Dear team,\n\nI build APIs.' },
    ]);
  });

  it('uses the full name where the form asks for one name', () => {
    expect(planFill([field('Full name')], input).steps[0]?.value).toBe('Sam Rivera');
  });

  it('attaches the cover letter PDF to a cover letter upload', () => {
    expect(planFill([field('Cover Letter', { kind: 'file', required: false })], input).steps[0]).toMatchObject({ action: 'file', value: '/out/acme/cover-letter.pdf' });
  });

  it('answers other questions from saved answers that match them', () => {
    const plan = planFill([field('Phone', { kind: 'tel' }), field('LinkedIn Profile'), field('Are you authorized to work remotely from the Philippines?', { kind: 'radio', options: [{ label: 'Yes', value: 'true', selector: '#yes' }, { label: 'No', value: 'false', selector: '#no' }] })], input);
    expect(plan.missing).toEqual([]);
    expect(plan.steps.map((s) => [s.action, s.value])).toEqual([['type', '+63 917 555 0100'], ['type', 'https://linkedin.com/in/sam'], ['check', '#yes']]);
  });

  it('lists every required field it cannot fill, so the form is handed over instead of sent', () => {
    const plan = planFill([field('Current company'), field('Did you start your first answer with the exact phrase we asked for?'), field('Website', { required: false })], input);
    expect(plan.missing).toEqual(['Current company', 'Did you start your first answer with the exact phrase we asked for?']);
  });

  it('never ticks a consent box, even a required one', () => {
    const plan = planFill([field('I have read and accept the Privacy Notice', { kind: 'checkbox' })], input);
    expect(plan.steps).toEqual([]);
    expect(plan.missing).toEqual(['I have read and accept the Privacy Notice']);
  });

  it('never answers demographic questions, even when an answer matches', () => {
    const plan = planFill([field('Gender', { kind: 'select', required: false, options: [{ label: 'Male', value: 'm' }] })], { ...input, answers: [{ question: 'Gender', answer: 'Male' }] });
    expect(plan.steps).toEqual([]);
  });

  it("doesn't guess a choice whose answer isn't one of the options", () => {
    const plan = planFill([field('Are you authorized to work remotely from the Philippines?', { kind: 'select', options: [{ label: 'Authorized', value: 'a' }] })], input);
    expect(plan.missing).toHaveLength(1);
  });

  it('cannot attach a résumé it does not have', () => {
    expect(planFill([field('Resume', { kind: 'file' })], { ...input, files: { resume: '' } }).missing).toEqual(['Resume']);
  });
});
