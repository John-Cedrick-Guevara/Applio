import type { FactSuggestion } from '../../shared/types';

const BULLET = /^[-•*▪●◦‣–]\s+/;
/** Unbulleted lines longer than this read as prose (a fact); shorter ones as headings. */
const HEADING_MAX = 60;
const DEFAULT_GROUP = 'Imported';

/**
 * Turns résumé text into candidate facts, copied verbatim so nothing is
 * invented (SPEC §1). Bullets and long lines become facts, filed under the
 * nearest short line above them. Nothing enters the bank until the operator
 * accepts it.
 * @param existing Texts already in the fact bank; matches are skipped, ignoring case.
 */
export function suggestFacts(text: string, existing: readonly string[]): FactSuggestion[] {
  const seen = new Set(existing.map((t) => t.trim().toLowerCase()));
  const suggestions: FactSuggestion[] = [];
  let group = DEFAULT_GROUP;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bulleted = BULLET.test(line);
    if (!bulleted && line.length <= HEADING_MAX) {
      group = line;
      continue;
    }
    const fact = line.replace(BULLET, '').trim();
    const key = fact.toLowerCase();
    if (!fact || seen.has(key)) continue;
    seen.add(key);
    suggestions.push({ group, text: fact });
  }
  return suggestions;
}
