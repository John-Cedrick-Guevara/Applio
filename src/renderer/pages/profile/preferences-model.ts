import type { Fact, FactGroup, Preferences } from '../../../shared/types';

/** The editable preference fields as raw form text. */
export interface PreferencesDraft {
  roles: string;
  seniority: string;
  hours: string;
  pay: string;
}

/** Splits comma-separated input into trimmed, non-empty items. */
export function parseList(input: string): string[] {
  return input.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Stored preferences → editable form text. */
export function toDraft(p: Preferences): PreferencesDraft {
  return { roles: p.targetRoles.join(', '), seniority: p.seniority, hours: p.hoursOverlap, pay: p.minimumPay };
}

/**
 * Applies the form onto the stored preferences (fields the form doesn't edit
 * are kept). UX validation only — the main process validates again.
 */
export function fromDraft(d: PreferencesDraft, base: Preferences): { ok: true; value: Preferences } | { ok: false; error: string } {
  const targetRoles = parseList(d.roles);
  if (targetRoles.length === 0) return { ok: false, error: 'Add at least one role, e.g. "Backend Engineer".' };
  return {
    ok: true,
    value: { ...base, targetRoles, seniority: d.seniority.trim(), hoursOverlap: d.hours.trim(), minimumPay: d.pay.trim() },
  };
}

export interface FactSection {
  name: string;
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
      return { name: g.name, meta: g.dates ? `${g.dates} · ${count}` : count, facts: items };
    })
    .filter((s) => s.facts.length > 0);
}
