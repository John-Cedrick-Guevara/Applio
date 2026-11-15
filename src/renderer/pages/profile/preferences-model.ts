import type { EmploymentType, Fact, FactGroup, FactGroupKind, Preferences } from '../../../shared/types';

export type PayPeriod = 'hour' | 'month' | 'year';
export const PAY_PERIODS: readonly PayPeriod[] = ['hour', 'month', 'year'];
export const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'INR'] as const;
/** Seniority choices; the prefilter reads Intern/Entry and Mid (triage.ts). Empty means any. */
export const SENIORITY_LEVELS = ['Intern', 'Entry level', 'Mid level', 'Senior', 'Lead or above'] as const;

/** The editable preference fields, as the form holds them. */
export interface PreferencesDraft {
  roles: string;
  seniority: string;
  types: EmploymentType[];
  remoteOnly: boolean;
  hours: string;
  payAmount: string;
  payCurrency: string;
  payPeriod: PayPeriod;
  /** True once the operator changed a pay field; until then the saved minimum is kept exactly as it was. */
  payTouched?: boolean;
}

/** Splits comma-separated input into trimmed, non-empty items. */
export function parseList(input: string): string[] {
  return input.split(',').map((s) => s.trim()).filter(Boolean);
}

const CURRENCY_SIGN: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '₱': 'PHP', '₹': 'INR' };

/** A saved minimum ("30,000 PHP / month", "$45 / hour") as its parts; parts it doesn't name are empty. */
export function readPay(minimumPay: string): { amount: string; currency: string; period: PayPeriod | '' } {
  // "$120k / year or $45 / hour": the editor holds one minimum, so it reads the first, with its own period.
  const text = minimumPay.split(/\bor\b/i)[0] ?? '';
  const amount = /(\d[\d,]*(?:\.\d+)?)\s*(k)?/i.exec(text);
  const value = amount ? Number(amount[1]!.replace(/,/g, '')) * (amount[2] ? 1000 : 1) : undefined;
  const code = /\b(USD|EUR|GBP|PHP|AUD|CAD|SGD|INR|JPY|NZD|CHF)\b/i.exec(text)?.[1]?.toUpperCase();
  const sign = Object.entries(CURRENCY_SIGN).find(([s]) => text.includes(s))?.[1];
  const period = /\b(hour|hourly|hr)\b/i.test(text) ? 'hour' : /\b(month|monthly|mo)\b/i.test(text) ? 'month' : /\b(year|yearly|annual|yr)\b/i.test(text) ? 'year' : '';
  return { amount: value === undefined ? '' : String(value), currency: code ?? sign ?? '', period };
}

/**
 * True when a saved minimum lacks its currency or period. Such a minimum is
 * ambiguous ("30,000" could be pesos a month or dollars a year), so the prefilter
 * ignores it and Profile asks the operator to finish it.
 */
export function payNeedsDetail(minimumPay: string): boolean {
  if (!minimumPay.trim()) return false;
  const { currency, period } = readPay(minimumPay);
  return !currency || !period;
}

/** The likely currency for where the operator lives, from their profile location line. */
export function defaultCurrency(location: string): string {
  if (/philippines/i.test(location)) return 'PHP';
  if (/\b(uk|united kingdom|england|london)\b/i.test(location)) return 'GBP';
  if (/india/i.test(location)) return 'INR';
  if (/australia/i.test(location)) return 'AUD';
  if (/canada/i.test(location)) return 'CAD';
  if (/singapore/i.test(location)) return 'SGD';
  if (/germany|france|spain|italy|netherlands|ireland|portugal|austria|belgium|finland|greece/i.test(location)) return 'EUR';
  return 'USD';
}

/** Stored preferences → the form. `location` picks the currency when none is saved. */
export function toDraft(p: Preferences, location = ''): PreferencesDraft {
  const pay = readPay(p.minimumPay);
  return {
    roles: p.targetRoles.join(', '), seniority: p.seniority, types: [...p.employmentTypes], remoteOnly: p.remoteOnly, hours: p.hoursOverlap,
    payAmount: pay.amount, payCurrency: pay.currency || defaultCurrency(location), payPeriod: pay.period || 'month',
  };
}

/**
 * Applies the form onto the stored preferences (fields the form doesn't edit
 * are kept). Minimum pay is written with its currency and period. UX validation
 * only — the main process validates again.
 */
export function fromDraft(d: PreferencesDraft, base: Preferences): { ok: true; value: Preferences } | { ok: false; error: string } {
  const targetRoles = parseList(d.roles);
  if (targetRoles.length === 0) return { ok: false, error: 'Add at least one role, e.g. "Backend Engineer".' };
  const raw = d.payAmount.replace(/[,\s]/g, '');
  if (raw && !/^\d+(\.\d+)?$/.test(raw)) return { ok: false, error: 'Enter the minimum pay as a number, e.g. 30000.' };
  const minimumPay = !d.payTouched ? base.minimumPay : raw ? `${Number(raw).toLocaleString('en-US')} ${d.payCurrency} / ${d.payPeriod}` : '';
  return {
    ok: true,
    value: { ...base, targetRoles, seniority: d.seniority.trim(), employmentTypes: d.types, remoteOnly: d.remoteOnly, hoursOverlap: d.hours.trim(), minimumPay },
  };
}

export interface FactSection {
  name: string;
  kind?: FactGroupKind;
  meta: string;
  facts: Fact[];
}

/** Facts grouped into the profile's sections, in section order; empty sections are hidden. */
export function groupFacts(groups: FactGroup[], facts: Fact[]): FactSection[] {
  const known = new Set(groups.map((g) => g.name));
  // Facts in a group the profile doesn't list still show, in their own section at the end.
  const extra = [...new Set(facts.map((f) => f.group).filter((g) => !known.has(g)))].map((name) => ({ name }));
  return [...groups, ...extra]
    .map((g: FactGroup) => {
      const items = facts.filter((f) => f.group === g.name);
      const count = `${items.length} ${items.length === 1 ? 'fact' : 'facts'}`;
      return { name: g.name, ...(g.kind ? { kind: g.kind } : {}), meta: g.dates ? `${g.dates} · ${count}` : count, facts: items };
    })
    .filter((s) => s.facts.length > 0);
}

/** What the fact bank can be narrowed to; sections with no kind (or another kind) show under All only. */
export type FactFilter = 'all' | 'experience' | 'project' | 'skills';

/** The sections a filter shows. */
export function filterSections(sections: FactSection[], filter: FactFilter): FactSection[] {
  return filter === 'all' ? sections : sections.filter((s) => s.kind === filter);
}

/** Facts behind each filter, so All matches the tab's count; the skill chips count toward Skills only. */
export function factFilterCounts(sections: FactSection[], skills: readonly string[]): Record<FactFilter, number> {
  const count = (filter: FactFilter) => filterSections(sections, filter).reduce((n, s) => n + s.facts.length, 0);
  return { all: count('all'), experience: count('experience'), project: count('project'), skills: count('skills') + skills.length };
}
