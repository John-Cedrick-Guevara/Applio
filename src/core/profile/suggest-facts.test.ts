import { describe, expect, it } from 'vitest';
import { suggestFacts } from './suggest-facts';

const RESUME = `Jane Doe

EXPERIENCE
Acme Corp - Senior Engineer
- Cut p95 query time from 900 ms to 120 ms by redesigning the invoicing schema.
• Led on-call for payments across three time zones.
PROJECTS
* Built an offline-first Electron app that syncs SQLite with a REST API.`;

describe('suggestFacts', () => {
  it('suggests each bullet verbatim under the heading above it', () => {
    expect(suggestFacts(RESUME, [])).toEqual([
      { group: 'Acme Corp - Senior Engineer', text: 'Cut p95 query time from 900 ms to 120 ms by redesigning the invoicing schema.' },
      { group: 'Acme Corp - Senior Engineer', text: 'Led on-call for payments across three time zones.' },
      { group: 'PROJECTS', text: 'Built an offline-first Electron app that syncs SQLite with a REST API.' },
    ]);
  });

  it('treats a long unbulleted line as a fact rather than a heading', () => {
    const text = 'Summary\nBackend engineer with five years building payment systems in Node.js and PostgreSQL.';
    expect(suggestFacts(text, [])).toEqual([
      { group: 'Summary', text: 'Backend engineer with five years building payment systems in Node.js and PostgreSQL.' },
    ]);
  });

  it('files bullets with no heading above them under Imported', () => {
    expect(suggestFacts('- Shipped the billing portal end to end.', [])).toEqual([
      { group: 'Imported', text: 'Shipped the billing portal end to end.' },
    ]);
  });

  it('skips facts already in the bank and repeats within the resume', () => {
    const text = '- Shipped the billing portal.\n- Shipped the billing portal.\n- Owned on-call.';
    expect(suggestFacts(text, ['owned on-call.'])).toEqual([{ group: 'Imported', text: 'Shipped the billing portal.' }]);
  });

  it('joins a bullet wrapped across lines by the PDF back into one fact', () => {
    const text = `EXPERIENCE
• Cut reported production bugs from 30+/day to 5–10/day by rebuilding the orchestrator logic, and
rewriting prompts to be tenant-agnostic.
• Reduced reply latency from 20s to 6s by parallelizing reads, deferring work, and
now only review runs and confirm findings.`;
    expect(suggestFacts(text, [])).toEqual([
      { group: 'EXPERIENCE', text: 'Cut reported production bugs from 30+/day to 5–10/day by rebuilding the orchestrator logic, and rewriting prompts to be tenant-agnostic.' },
      { group: 'EXPERIENCE', text: 'Reduced reply latency from 20s to 6s by parallelizing reads, deferring work, and now only review runs and confirm findings.' },
    ]);
  });

  it('suggests nothing for text with no bullets or sentences', () => {
    expect(suggestFacts('Jane Doe\nEXPERIENCE\n', [])).toEqual([]);
  });
});
