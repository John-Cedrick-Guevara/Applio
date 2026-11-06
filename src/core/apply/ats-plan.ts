import type { FormField } from './ats-form';

/** One thing to do to the form: type text, attach a file, pick an option, or check a radio or box. */
export interface FillStep {
  selector: string;
  /** The question, for the send log. */
  label: string;
  action: 'type' | 'file' | 'select' | 'check';
  /** Text, a file path, an option value, or (for check) the selector of the option to check. */
  value: string;
}

export interface FillInput {
  applicant: { fullName: string; email: string };
  files: { resume: string; coverLetter?: string };
  letter: string;
  /** The draft's answers, then the answer bank. */
  answers: { question: string; answer: string }[];
}

export interface FillPlan {
  steps: FillStep[];
  /** Required questions Applio can't answer; any at all means the operator finishes the form. */
  missing: string[];
}

// Never answered for the operator: demographic (EEO) questions and anything that accepts terms.
const SENSITIVE = /gender|pronoun|race|ethnic|hispanic|latin|veteran|disabilit|sexual|orientation|religio|age range|date of birth|transgender|neurodiver/i;

const STOP = new Set(['the', 'a', 'an', 'you', 'your', 'are', 'do', 'to', 'of', 'in', 'for', 'and', 'or', 'is', 'what', 'please', 'url', 'profile', 'link']);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9+]+/).filter((w) => w.length > 1 && !STOP.has(w)));

/** How well a saved question fits a form question: the share of the form question's words it covers. */
const fit = (formQuestion: string, saved: string) => {
  const f = words(formQuestion);
  const s = words(saved);
  if (f.size === 0 || s.size === 0) return 0;
  return [...f].filter((w) => s.has(w)).length / Math.max(f.size, s.size);
};

/**
 * Decides what goes into each field of an ATS form (SPEC F5 channel 2). Identity
 * and files come from the profile and the job folder; every other question needs a
 * saved answer that matches it. Demographic questions and consent boxes are never
 * touched. A required field left over means no submit: the operator finishes it.
 */
export function planFill(fields: readonly FormField[], input: FillInput): FillPlan {
  const [first = '', ...rest] = input.applicant.fullName.trim().split(/\s+/);
  const last = rest.join(' ');
  const steps: FillStep[] = [];
  const missing: string[] = [];

  const answerFor = (question: string) => {
    const best = input.answers.map((a) => ({ a, score: fit(question, a.question) })).sort((x, y) => y.score - x.score)[0];
    return best && best.score >= 0.6 ? best.a.answer : undefined;
  };

  for (const f of fields) {
    const text = `${f.label} ${f.selector}`.toLowerCase();
    const step = (action: FillStep['action'], value: string | undefined) => {
      if (value) steps.push({ selector: f.selector, label: f.label, action, value });
      else if (f.required) missing.push(f.label);
    };

    if (SENSITIVE.test(f.label)) {
      if (f.required) missing.push(f.label);
      continue;
    }
    // Boxes are consents or self-identification; a required one is the operator's to tick.
    if (f.kind === 'checkbox') {
      if (f.required) missing.push(f.label);
      continue;
    }
    if (f.kind === 'file') {
      if (/cover/.test(text)) step('file', input.files.coverLetter);
      else step('file', input.files.resume || undefined);
      continue;
    }
    if (/cover letter/.test(text) && (f.kind === 'textarea' || f.kind === 'text')) {
      step('type', input.letter);
      continue;
    }
    if (/\bfirst name\b|given name|firstname/.test(text)) step('type', first);
    else if (/\blast name\b|surname|family name|lastname/.test(text)) step('type', last);
    else if (f.kind === 'email' || /^e-?mail( address)?$/i.test(f.label)) step('type', input.applicant.email);
    else if (/^(full |legal |your )?name$/i.test(f.label)) step('type', input.applicant.fullName);
    else if (f.kind === 'select' || f.kind === 'radio') {
      const answer = answerFor(f.label)?.toLowerCase();
      const option = answer ? f.options?.find((o) => o.label.toLowerCase() === answer || o.value.toLowerCase() === answer) : undefined;
      if (f.kind === 'radio') step('check', option?.selector);
      else step('select', option?.value);
    } else step('type', answerFor(f.label));
  }
  return { steps, missing };
}
