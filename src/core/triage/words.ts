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
/** Words companies add or drop between boards ("Northbeam Labs" vs "Northbeam"), so they don't split one company in two. */
const COMPANY_NOISE = /\b(labs?|technologies|technology|tech|hq|studios?|group|ai|io|app|software|solutions|systems)\b/g;

/**
 * A company name for comparison: lowercase, punctuation, legal suffixes ("Inc.", "GmbH")
 * and descriptors ("Labs", "Technologies") dropped. A name that is only a descriptor keeps it.
 */
export function companyKey(company: string): string {
  const base = company.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(COMPANY_SUFFIX, ' ').replace(/\s+/g, ' ').trim();
  return base.replace(COMPANY_NOISE, ' ').replace(/\s+/g, ' ').trim() || base;
}

/** Title words that name a different job than the role around them ("Web Dev *Specialist*"). */
const OTHER_ROLE = new Set(['specialist', 'manager', 'consultant', 'interviewer', 'recruiter', 'trainer', 'scientist', 'analyst', 'designer', 'writer', 'tester', 'sdet', 'admin', 'administrator', 'assistant', 'coordinator', 'director', 'instructor', 'tutor']);
/** Level words that may precede the noun in the inverted form ("Senior Engineer, Platform"). */
const SENIORITY_WORDS = new Set(['senior', 'junior', 'staff', 'principal', 'lead']);
/** Level suffixes after a role ("Engineer II", "Engineer 3"). */
const LEVEL = /^(?:i{1,3}|iv|v|[1-5]|l[1-9])$/;

/**
 * Whether a title is for one target role (normalized words from `titleWords`). The
 * title is split into parts at commas, dashes, pipes, "and"/"&" and brackets; one part
 * must hold every role word and either name them in order or end on the role's own
 * noun, and that part mustn't end on a different job ("Specialist", "Interviewer").
 * So "AI/Automation Engineer" is an AI Engineer, but "SEO and Web Dev Specialist" isn't a Web Developer.
 */
export function roleMatches(title: string, role: readonly string[]): boolean {
  const head = role.at(-1);
  if (!head) return false;
  const parts = title.toLowerCase().split(/[,|·:;()[\]–—+&]| - | and | for | at | in | with /);
  // The inverted form boards use: "Engineer, Platform" is a Platform Engineer, but only when the first part is the bare noun.
  const [first = '', second = ''] = parts;
  const lead = titleWords(first).filter((w) => !SENIORITY_WORDS.has(w));
  if (lead.length === 1 && lead[0] === head && role.slice(0, -1).every((w) => titleWords(second).includes(w))) return true;
  return parts.some((part) => {
    const words = titleWords(part);
    while (words.length > 1 && LEVEL.test(words.at(-1)!)) words.pop();
    const last = words.at(-1);
    if (!last || !role.every((w) => words.includes(w))) return false;
    if (OTHER_ROLE.has(last) && last !== head) return false;
    const inOrder = words.join(' ').includes(role.join(' '));
    return inOrder || last === head;
  });
}
