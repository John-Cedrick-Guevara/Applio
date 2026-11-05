/** Spellings boards use for the same word, mapped to one form. */
const VARIANTS: Record<string, string> = {
  sr: 'senior', jr: 'junior', snr: 'senior', developer: 'engineer', dev: 'engineer', programmer: 'engineer',
  backend: 'backend', frontend: 'frontend', fullstack: 'fullstack', devops: 'devops',
};

/** Joined forms boards write with a space or hyphen ("back end", "full-stack"). */
const JOINED: [RegExp, string][] = [
  [/\bback[\s-]+end\b/g, 'backend'],
  [/\bfront[\s-]+end\b/g, 'frontend'],
  [/\bfull[\s-]+stack\b/g, 'fullstack'],
  [/\bdev[\s-]+ops\b/g, 'devops'],
];

/**
 * A title's words, normalized so variants compare equal: lowercase, bracketed
 * asides like "(m/w/d)" and "[Remote]" removed, joined forms unified, and
 * abbreviations expanded ("Sr. Back-end Dev" → senior backend engineer).
 */
export function titleWords(title: string): string[] {
  let t = title.toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  for (const [re, to] of JOINED) t = t.replace(re, to);
  return t
    .split(/[^a-z0-9+#]+/)
    .filter(Boolean)
    .map((w) => VARIANTS[w] ?? w);
}

const COMPANY_SUFFIX = /\b(inc|llc|ltd|limited|gmbh|ag|sa|sas|bv|plc|corp|corporation|co|company|pty)\b\.?/g;

/** A company name for comparison: lowercase, punctuation and legal suffixes ("Inc.", "GmbH") dropped. */
export function companyKey(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(COMPANY_SUFFIX, ' ').replace(/\s+/g, ' ').trim();
}
