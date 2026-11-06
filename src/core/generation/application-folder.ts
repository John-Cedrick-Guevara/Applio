import type { Job } from '../../shared/types';

/**
 * A company or role as a file-name part: no characters any desktop OS forbids,
 * no emoji (sync tools and upload forms choke on them), no leading dots, at most 60.
 */
export function safeName(raw: string): string {
  return raw
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[/\\]/g, '-')
    .replace(/[<>:"|?*]/g, '')
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 60)
    .trim();
}

/** `YYYY-MM/<Company> — <Role> (<score>%)` under the output folder (SPEC F8), by local month. */
export function folderFor(job: Pick<Job, 'company' | 'title' | 'score'>, at: Date): string {
  const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
  return `${month}/${safeName(job.company)} — ${safeName(job.title)} (${job.score ?? 0}%)`;
}

const ID_LINE = /^applio_job_id: (\S+)$/m;

/**
 * `job.md`: the original posting and what Applio learned (SPEC F8). The job id in
 * its front matter lets a renamed or moved folder be found again.
 */
export function jobMarkdown(job: Job): string {
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- none');
  return `---
applio_job_id: ${job.id}
---

# ${job.title} — ${job.company}

Match score: ${job.score ?? 'not scored'}%
Found on ${job.sourceName}: ${job.url}
Apply: ${job.applyTarget}

## Role
${job.roleSummary ?? ''}

## Summary
${job.descriptionSummary ?? ''}

## Strengths
${list(job.strengths)}

## Gaps
${list(job.gaps)}

## Original posting
${job.description}
`;
}

/** The job id in a `job.md` Applio wrote, or undefined. */
export function jobIdIn(markdown: string): string | undefined {
  return markdown.startsWith('---\n') ? ID_LINE.exec(markdown)?.[1] : undefined;
}
