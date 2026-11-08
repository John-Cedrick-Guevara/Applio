/** What a draft may draw on: the fact bank, profile and the posting itself. */
export interface CheckSources {
  facts: readonly { id: string; group: string; text: string }[];
  groups: readonly { name: string; context?: string; dates?: string }[];
  contact: { location: string; education: string; notes: string; phone?: string; links?: readonly { label: string; url: string }[] };
  /** The operator's name and email, which sign the letter. */
  owner: string;
  job: { company: string; title: string; description: string };
}

/** A cover-letter sentence naming something no source states. */
export interface UnverifiedLine {
  line: string;
  terms: string[];
}

/** Words that are capitalized but never a claim: greetings, sign-offs, calendar words, pronouns. */
const NOT_CLAIMS = new Set(
  ('i im ive id ill dear hi hello hey best regards kind thanks thank sincerely cheers warm team hiring manager recruiter ' +
    'january february march april may june july august september october november december ' +
    'monday tuesday wednesday thursday friday saturday sunday the a an and or but my your our we you it this that these those ' +
    'as at in on for with from to of by if when while also please looking excited happy').split(' '),
);

/** "December 1", "Dec 1st": a date's day number isn't a claim. */
const DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi;

const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Numbers a text states, normalized ("40%" → "40", "1,500" → "1500"). */
const numbersIn = (text: string) => (text.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,]/g, '').replace(/\.$/, ''));

/**
 * Terms the operator's notes forbid, from simple rules like "Never use 'Internship'"
 * or "Don't say rockstar". Lowercase, in the order written. Anything subtler stays
 * with Claude, which reads the notes too.
 */
export function forbiddenTerms(notes: string): string[] {
  const rule = /\b(?:never|don['’]t|do not|avoid)\s+(?:use|say|write|call|mention)\s+(?:the word\s+)?["'“‘]?([\w-]+)/gi;
  return [...notes.matchAll(rule)].map((m) => m[1]!.toLowerCase());
}

/** A term and the forms it hides in ("internship" → "intern", "interns"). */
const forms = (term: string) => [term, term.replace(/(ship|ing|ed|s)$/, '')].filter((t, i, all) => t.length > 2 && all.indexOf(t) === i);

/**
 * Checks a draft against what it may draw on (SPEC §1 "never invent"), deterministically:
 * cover-letter sentences that name a capitalized term or a number no fact, profile line
 * or posting states (e.g. "Marikina", "PhD", "70%"), and any term the operator's notes
 * forbid, in the letter or the résumé. Résumé bullets are traced by fact ID when saved.
 */
export function checkDraft(draft: { coverLetter: string; resume: readonly { items: readonly { text: string }[] }[] }, sources: CheckSources): { unverified: UnverifiedLine[]; forbidden: string[] } {
  const known = [
    ...sources.facts.flatMap((f) => [f.text, f.group]),
    ...sources.groups.flatMap((g) => [g.name, g.context ?? '', g.dates ?? '']),
    ...(sources.contact.links ?? []).flatMap((l) => [l.label, l.url]),
    sources.contact.location, sources.contact.education, sources.contact.phone ?? '', sources.owner,
    sources.job.company, sources.job.title, sources.job.description,
  ].join('\n');
  const knownWords = new Set(known.toLowerCase().match(/[a-z0-9+#]+/g) ?? []);
  const knownNumbers = new Set(numbersIn(known));

  const unverified = sentences(draft.coverLetter).flatMap((line) => {
    const words = [...line.matchAll(/\b[A-Z][A-Za-z0-9+#]*\b/g)].filter((m) => m.index !== 0 || /[a-z][A-Z]|[A-Z]{2}/.test(m[0]));
    const terms = [
      ...words.map((m) => m[0]).filter((w) => !NOT_CLAIMS.has(w.toLowerCase()) && !knownWords.has(w.toLowerCase())),
      ...[...line.replace(DATE, ' ').matchAll(/\d[\d,.]*%?/g)].map((m) => m[0].replace(/\.$/, '')).filter((n) => !knownNumbers.has(n.replace(/[,%]/g, ''))),
    ];
    return terms.length ? [{ line, terms: [...new Set(terms)] }] : [];
  });

  const text = [draft.coverLetter, ...draft.resume.flatMap((s) => s.items.map((i) => i.text))].join('\n').toLowerCase();
  const forbidden = [...new Set(forbiddenTerms(sources.contact.notes).flatMap(forms))]
    .filter((t) => new RegExp(`\\b${t}\\b`).test(text))
    .sort();
  return { unverified, forbidden };
}

/**
 * A short fingerprint of everything a draft is made from (facts, sections, contact
 * and notes). Saved with each draft; when it no longer matches, the draft was made
 * from an older profile. FNV-1a, so it runs the same in every process.
 */
export function profileVersion(p: Pick<CheckSources, 'facts' | 'groups' | 'contact'>): string {
  const text = JSON.stringify([p.facts.map((f) => [f.id, f.group, f.text]), p.groups.map((g) => [g.name, g.context ?? '', g.dates ?? '']), [p.contact.location, p.contact.education, p.contact.notes, p.contact.phone ?? '']]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(36);
}
