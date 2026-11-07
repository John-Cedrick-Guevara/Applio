import type { Contact, Draft, FactGroup, FactGroupKind, Job, ResumeSection } from '../types';

/** Whose documents these are; empty fields are left out, never made up. */
export interface DocumentOwner {
  name: string;
  email: string;
  /** Header and sign-off details; the locked layout prints these as written. */
  contact?: Contact;
  /** Fact-bank sections, for each résumé section's kind, dates, context and link. */
  groups?: readonly FactGroup[];
}

/** Escapes text for HTML. Draft text is shaped by job postings, so nothing goes in unescaped. */
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The one ATS-safe template (SPEC F4): a single column, standard headings, real
 * text, system fonts, no tables, images or columns that parsers trip on. Scoped
 * to `.applio-doc` so the Review preview can show the same markup in the app.
 */
export const DOC_CSS = `.applio-doc{font-family:Helvetica,Arial,sans-serif;color:#111;font-size:10.5pt;line-height:1.4}
.applio-doc h1{font-size:18pt;margin:0 0 2pt}
.applio-doc h2{font-size:11pt;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #999;margin:12pt 0 4pt;padding-bottom:2pt}
.applio-doc .contact,.applio-doc .meta{color:#444;margin:0 0 6pt}
.applio-doc .headline{font-weight:bold;margin:4pt 0}
.applio-doc ul{margin:0;padding-left:14pt}
.applio-doc li{margin:0 0 2pt}
.applio-doc p{margin:0 0 8pt}
.applio-doc .strategist{font-family:"Times New Roman",Times,serif;font-size:9.7pt;line-height:1.2;color:#000}
.strategist .name{text-align:center;font-size:15pt;font-weight:bold;margin:0}
.strategist .title,.strategist .contact,.strategist .links{text-align:center;margin:1pt 0}
.strategist .title{font-weight:bold}
.strategist a{color:#000}
.strategist h2{font-size:10.5pt;text-transform:none;letter-spacing:.03em;border-bottom:.75pt solid #000;margin:6pt 0 2pt;padding-bottom:1pt}
.strategist .entry-head{display:flex;justify-content:space-between;gap:8pt;margin-top:3pt}
.strategist .context{margin:0 0 1pt;font-style:italic}
.strategist p{margin:0 0 2pt}
.strategist ul{padding-left:12pt}
.strategist li{margin:0 0 1pt}`;

const header = ({ name, email }: DocumentOwner) =>
  (name ? `<h1>${escapeHtml(name)}</h1>` : '') + (email ? `<p class="contact">${escapeHtml(email)}</p>` : '');

const e = escapeHtml;
const host = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
/** Résumé order, whatever order the draft put its sections in (SPEC F4, locked layout). */
const ORDER: { kind: FactGroupKind; heading: string }[] = [
  { kind: 'experience', heading: 'EXPERIENCE' },
  { kind: 'project', heading: 'PROJECTS' },
  { kind: 'skills', heading: 'TECHNICAL SKILLS' },
  { kind: 'certifications', heading: 'CERTIFICATIONS & ACHIEVEMENTS' },
  { kind: 'other', heading: 'OTHER' },
];
const bullets = (s: ResumeSection) => `<ul>${s.items.map((i) => `<li>${e(i.text)}</li>`).join('')}</ul>`;

/** One section's block. Role, dates, context and link come from the fact bank, never from the draft (AC-6). */
const entry = (s: ResumeSection, g: FactGroup | undefined): string => {
  const kind = g?.kind ?? 'other';
  if (kind === 'skills') return `<p><strong>${e(s.heading)}:</strong> ${s.items.map((i) => e(i.text)).join(', ')}</p>`;
  if (kind === 'certifications') return bullets(s);
  const context = g?.context ? `<p class="context">${e(g.context)}</p>` : '';
  if (kind === 'project') {
    const parts = [`<strong>${e(s.heading)}</strong>`, ...(g?.link ? [`<a href="${e(g.link)}">${e(host(g.link))}</a>`] : []), ...(g?.dates ? [e(g.dates)] : [])];
    return `<div class="entry-head"><span>${parts.join(' | ')}</span></div>${context}${bullets(s)}`;
  }
  const dates = g?.dates ? `<span class="dates">${e(g.dates)}</span>` : '';
  return `<div class="entry-head"><strong>${e(s.heading)}</strong>${dates}</div>${context}${bullets(s)}`;
};

/** The locked one-page layout: header, summary, then sections by kind, then education. */
const lockedResume = (draft: Draft, owner: DocumentOwner): string => {
  const groups = new Map((owner.groups ?? []).map((g) => [g.name, g]));
  const c = owner.contact;
  const contactLine = [c?.location, c?.phone, owner.email].filter(Boolean).map((x) => e(x!)).join(' • ');
  const links = (c?.links ?? []).map((l) => `<a href="${e(l.url)}">${e(l.label)}</a>`).join(' • ');
  const head = (owner.name ? `<h1 class="name">${e(owner.name.toUpperCase())}</h1>` : '')
    + `<p class="title">${e(draft.headline)}</p>`
    + (contactLine ? `<p class="contact">${contactLine}</p>` : '')
    + (links ? `<p class="links">${links}</p>` : '');
  const body = ORDER.map(({ kind, heading }) => {
    const sections = draft.resume.filter((s) => (groups.get(s.group ?? '')?.kind ?? 'other') === kind);
    return sections.length ? `<h2>${e(heading)}</h2>${sections.map((s) => entry(s, groups.get(s.group ?? ''))).join('')}` : '';
  }).join('');
  const education = c?.education ? `<h2>EDUCATION</h2><p>${e(c.education)}</p>` : '';
  return `<div class="strategist">${head}<h2>SUMMARY</h2><p>${e(draft.summary)}</p>${body}${education}</div>`;
};

/** True for drafts made with the locked layout, whose sections name their fact-bank section. */
export const isLockedLayout = (draft: Draft) => draft.resume.some((s) => s.group !== undefined);

/**
 * The letter's closing: name, then phone and the first link's address, from
 * Profile so Claude can't get them wrong.
 */
export function signOff(owner: DocumentOwner): string {
  const reach = [owner.contact?.phone, owner.contact?.links[0] ? host(owner.contact.links[0].url) : ''].filter(Boolean).join(' | ');
  return [owner.name, reach].filter(Boolean).join('\n');
}

/** Filename-safe words: letters, digits and hyphens, joined by underscores. */
const fileWords = (s: string) => s.split(/[^\p{L}\p{N}-]+/u).filter(Boolean).join('_');

/**
 * What the documents are called when they leave the machine, e.g.
 * `Guevara_AI_Engineer.pdf`: the operator's last name and the role (SPEC F4).
 */
export function documentNames(ownerName: string, role: string): { resume: string; letter: string } {
  const base = [fileWords(ownerName.trim().split(/\s+/).at(-1) ?? ''), fileWords(role)].filter(Boolean).join('_') || 'Resume';
  return { resume: `${base}.pdf`, letter: `${base}_Cover_Letter.pdf` };
}

/** The tailored résumé's markup: the locked layout for new drafts, the original one for older drafts. */
export function resumeBody(draft: Draft, owner: DocumentOwner): string {
  if (isLockedLayout(draft)) return lockedResume(draft, owner);
  const sections = draft.resume
    .map((s) => `<h2>${escapeHtml(s.heading)}</h2><ul>${s.items.map((i) => `<li>${escapeHtml(i.text)}</li>`).join('')}</ul>`)
    .join('');
  return `${header(owner)}<p class="headline">${escapeHtml(draft.headline)}</p><p>${escapeHtml(draft.summary)}</p>${sections}`;
}

/** The cover letter's (or proposal's) markup: one paragraph per blank-line block. */
export function letterBody(draft: Draft, job: Pick<Job, 'company' | 'title'>, owner: DocumentOwner): string {
  const paragraphs = draft.coverLetter
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  // Older drafts wrote their own sign-off; only locked-layout letters get Applio's.
  const closing = isLockedLayout(draft) ? `<p>${escapeHtml(signOff(owner)).replace(/\n/g, '<br>')}</p>` : '';
  return `${header(owner)}<p class="meta">${escapeHtml(job.company)} · ${escapeHtml(job.title)}</p>${paragraphs}${closing}`;
}

/** A whole printable page around one document's markup, for `printToPDF`. */
export function pageHtml(body: string, title: string): string {
  const locked = body.startsWith('<div class="strategist">');
  const page = locked ? '@page{size:A4;margin:12.7mm}' : '@page{margin:16mm}';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${page}body{margin:0}${DOC_CSS}</style></head><body><div class="applio-doc">${body}</div></body></html>`;
}
