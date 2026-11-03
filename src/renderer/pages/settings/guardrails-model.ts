import type { Settings } from '../../../shared/types';

export type GuardrailValues = Pick<Settings, 'draftThreshold' | 'autoSendThreshold' | 'maxPerChannelPerDay' | 'dailyTokenBudget'>;

/** Guardrail inputs as typed by the operator. */
export interface GuardrailsDraft {
  draft: string;
  auto: string;
  perDay: string;
  tokens: string;
}

export type GuardrailErrors = Partial<Record<keyof GuardrailsDraft, string>>;

/** Whole number ≥ 0; thousands separators allowed ("150,000"). NaN otherwise. */
const whole = (s: string) => {
  const clean = s.replace(/[,\s_]/g, '');
  return /^\d+$/.test(clean) ? Number(clean) : NaN;
};

/** Stored guardrail settings → form text (token budget with thousands separators). */
export function toGuardrailsDraft(v: GuardrailValues): GuardrailsDraft {
  return {
    draft: String(v.draftThreshold),
    auto: String(v.autoSendThreshold),
    perDay: String(v.maxPerChannelPerDay),
    tokens: v.dailyTokenBudget.toLocaleString('en-US'),
  };
}

/**
 * Validates guardrails (SPEC F6, F10). Auto-send may never sit below the draft
 * threshold. UX only — main re-validates before saving.
 */
export function parseGuardrails(d: GuardrailsDraft): { ok: true; value: GuardrailValues } | { ok: false; errors: GuardrailErrors } {
  const errors: GuardrailErrors = {};
  const draft = whole(d.draft);
  const auto = whole(d.auto);
  const perDay = whole(d.perDay);
  const tokens = whole(d.tokens);

  if (Number.isNaN(draft) || draft > 100) errors.draft = 'Enter a score between 0 and 100.';
  if (Number.isNaN(auto) || auto > 100) errors.auto = 'Enter a score between 0 and 100.';
  else if (!errors.draft && auto < draft) errors.auto = 'Auto-send must be at least the draft score.';
  if (Number.isNaN(perDay)) errors.perDay = 'Enter a whole number, 0 or more.';
  if (Number.isNaN(tokens) || tokens < 1) errors.tokens = 'Enter a token budget above 0.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { draftThreshold: draft, autoSendThreshold: auto, maxPerChannelPerDay: perDay, dailyTokenBudget: tokens } };
}
