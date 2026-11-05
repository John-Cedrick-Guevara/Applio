import type { z } from 'zod';
import type { DiscoveredJob, SourceFetch } from '../../core/jobs/source';
import type { EmploymentType } from '../../shared/types';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Decodes the HTML entities boards put in titles and descriptions ("&amp;", "&#8217;"). */
export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/**
 * Undoes UTF-8 that was decoded as Latin-1 and re-encoded ("HÃ¤user" → "Häuser"), which some
 * boards send. Each broken sequence is repaired on its own, so correct text around it is kept;
 * a sequence that isn't valid UTF-8 stays as it was.
 */
export function repairMojibake(s: string): string {
  return s.replace(/[\u00c2-\u00f4][\u0080-\u00bf]{1,3}/g, (run) => {
    const repaired = Buffer.from(run, 'latin1').toString('utf8');
    return repaired.includes('\ufffd') ? run : repaired;
  });
}

/**
 * Job descriptions arrive as HTML; the pipeline and the AI only ever see text.
 * Block-level ends become line breaks, tags are dropped, and blank runs are collapsed.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Maps a board's free-text job type ("Full-Time", "Contractor", "freelance") to ours, or undefined. */
export function employmentFrom(value: string | readonly string[] | undefined | null): EmploymentType | undefined {
  const text = (Array.isArray(value) ? value.join(' ') : String(value ?? '')).toLowerCase();
  if (text.includes('freelanc')) return 'freelance';
  if (text.includes('contract')) return 'contract';
  if (/full[\s_-]?time/.test(text)) return 'full-time';
  return undefined;
}

/** Epoch seconds, or an ISO date (a missing zone means UTC), as an ISO string. */
export function isoFrom(value: string | number): string {
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`).toISOString();
}

/**
 * Validates each item at the trust boundary and normalizes the ones that fit.
 * One odd item never sinks the whole poll: it's dropped and counted.
 */
export function parseItems<S extends z.ZodType>(schema: S, items: readonly unknown[], toJob: (item: z.infer<S>) => DiscoveredJob): SourceFetch {
  const jobs: DiscoveredJob[] = [];
  let dropped = 0;
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) jobs.push(toJob(parsed.data));
    else dropped++;
  }
  return { jobs, dropped };
}
