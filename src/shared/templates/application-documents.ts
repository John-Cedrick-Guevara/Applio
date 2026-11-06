import type { Draft, Job } from '../types';

/** Whose documents these are; empty fields are left out, never made up. */
export interface DocumentOwner {
  name: string;
  email: string;
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
.applio-doc p{margin:0 0 8pt}`;

const header = ({ name, email }: DocumentOwner) =>
  (name ? `<h1>${escapeHtml(name)}</h1>` : '') + (email ? `<p class="contact">${escapeHtml(email)}</p>` : '');

/** The tailored résumé's markup: headline, summary, then each section's lines. */
export function resumeBody(draft: Draft, owner: DocumentOwner): string {
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
  return `${header(owner)}<p class="meta">${escapeHtml(job.company)} · ${escapeHtml(job.title)}</p>${paragraphs}`;
}

/** A whole printable page around one document's markup, for `printToPDF`. */
export function pageHtml(body: string, title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{margin:16mm}body{margin:0}${DOC_CSS}</style></head><body><div class="applio-doc">${body}</div></body></html>`;
}
