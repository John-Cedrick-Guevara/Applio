import { z } from 'zod';
import type { DiscoveredJob, HttpGet, JobSource } from '../../core/jobs/source';
import { decodeEntities, employmentFrom, htmlToText, isoFrom, parseItems } from './normalize';
import type { SourceFetch } from '../../core/jobs/source';

export type AtsPlatform = 'greenhouse' | 'lever' | 'ashby' | 'workable';

/** One company the operator watches: its ATS and the board's slug (e.g. greenhouse / "gitlab"). */
export interface WatchEntry {
  ats: AtsPlatform;
  slug: string;
}

type Base = Pick<DiscoveredJob, 'sourceId' | 'sourceName'>;
type Reader = (http: HttpGet, slug: string, base: (name: string) => Base) => Promise<SourceFetch>;

const money = (n: number) => n.toLocaleString('en-US');

const Greenhouse = z.object({
  id: z.number(), title: z.string(), company_name: z.string(), absolute_url: z.url(), first_published: z.string().nullish(),
  updated_at: z.string(), content: z.string(), location: z.object({ name: z.string() }).nullish(),
  departments: z.array(z.object({ name: z.string() })).default([]),
});
const Lever = z.object({
  id: z.string(), text: z.string(), hostedUrl: z.url(), applyUrl: z.url(), createdAt: z.number(), descriptionPlain: z.string().default(''),
  workplaceType: z.string().nullish(), categories: z.object({ location: z.string().nullish(), commitment: z.string().nullish(), team: z.string().nullish() }).default({}),
  salaryRange: z.object({ min: z.number(), max: z.number(), currency: z.string() }).nullish(),
});
const Ashby = z.object({
  id: z.string(), title: z.string(), jobUrl: z.url(), applyUrl: z.url(), publishedAt: z.string(), descriptionHtml: z.string(),
  location: z.string(), isRemote: z.boolean().nullish(), employmentType: z.string().nullish(), department: z.string().nullish(),
  compensation: z.object({ compensationTierSummary: z.string().nullish() }).nullish(),
});
const Workable = z.object({
  shortcode: z.string(), title: z.string(), url: z.url(), application_url: z.url(), published_on: z.string(), telecommuting: z.boolean(),
  employment_type: z.string().nullish(), department: z.string().nullish(), function: z.string().nullish(),
  city: z.string().nullish(), country: z.string().nullish(),
});

/** Each platform's public board API. Credit goes to the company's own board, which `boardUrl` links to. */
const READERS: Record<AtsPlatform, { host: string; name: string; read: Reader }> = {
  greenhouse: {
    host: 'boards-api.greenhouse.io', name: 'Greenhouse',
    read: async (http, slug, base) => {
      const body = z.object({ jobs: z.array(z.unknown()) }).parse(await http.getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`));
      return parseItems(Greenhouse, body.jobs, (j) => {
        const location = j.location?.name ?? '';
        return {
          ...base('Greenhouse'), externalId: String(j.id), company: j.company_name, title: decodeEntities(j.title), boardUrl: j.absolute_url, applyUrl: j.absolute_url,
          // Greenhouse double-escapes its HTML (`&lt;p&gt;`), so decode once before stripping tags.
          description: htmlToText(decodeEntities(j.content)), location, postedAt: isoFrom(j.first_published ?? j.updated_at),
          tags: j.departments.map((d) => d.name), remote: /\bremote\b/i.test(location),
        };
      });
    },
  },
  lever: {
    host: 'api.lever.co', name: 'Lever',
    read: async (http, slug, base) => {
      const body = z.array(z.unknown()).parse(await http.getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`));
      return parseItems(Lever, body, (j) => ({
        ...base('Lever'), externalId: j.id, company: slug, title: j.text, boardUrl: j.hostedUrl, applyUrl: j.applyUrl,
        description: j.descriptionPlain.trim() || j.text, location: j.categories.location ?? '', postedAt: new Date(j.createdAt).toISOString(),
        tags: [j.categories.team].filter((t): t is string => !!t), remote: j.workplaceType === 'remote',
        employmentType: employmentFrom(j.categories.commitment),
        salary: j.salaryRange ? `${j.salaryRange.currency} ${money(j.salaryRange.min)}–${money(j.salaryRange.max)}` : undefined,
      }));
    },
  },
  ashby: {
    host: 'api.ashbyhq.com', name: 'Ashby',
    read: async (http, slug, base) => {
      const body = z.object({ jobs: z.array(z.unknown()) }).parse(await http.getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`));
      return parseItems(Ashby, body.jobs, (j) => ({
        ...base('Ashby'), externalId: j.id, company: slug, title: j.title, boardUrl: j.jobUrl, applyUrl: j.applyUrl,
        description: htmlToText(j.descriptionHtml), location: j.location, postedAt: isoFrom(j.publishedAt),
        tags: [j.department].filter((t): t is string => !!t), remote: j.isRemote ?? undefined,
        employmentType: employmentFrom(j.employmentType === 'FullTime' ? 'full-time' : j.employmentType), salary: j.compensation?.compensationTierSummary ?? undefined,
      }));
    },
  },
  workable: {
    host: 'apply.workable.com', name: 'Workable',
    read: async (http, slug, base) => {
      const body = z.object({ name: z.string(), jobs: z.array(z.unknown()) }).parse(await http.getJson(`https://apply.workable.com/api/v1/widget/accounts/${slug}`));
      return parseItems(Workable, body.jobs, (j) => ({
        ...base('Workable'), externalId: j.shortcode, company: body.name, title: j.title, boardUrl: j.url, applyUrl: j.application_url,
        // The widget API has no description; the posting's own facts stand in until the job page is read.
        description: [j.title, j.department, j.function].filter(Boolean).join('\n'),
        location: [j.city, j.country].filter(Boolean).join(', '), postedAt: isoFrom(`${j.published_on}T00:00:00`),
        tags: [j.department].filter((t): t is string => !!t), remote: j.telecommuting, employmentType: employmentFrom(j.employment_type),
      }));
    },
  },
};

/**
 * The operator's ATS watchlist (SPEC F2): each listed company's public board on
 * Greenhouse, Lever, Ashby or Workable. Starts empty and makes no requests until
 * a company is added. One company failing is noted; all failing fails the source.
 */
export function createAtsWatchlist(watchlist: () => readonly WatchEntry[]): JobSource {
  return {
    id: 'ats',
    name: 'ATS watchlist',
    dailyPollLimit: 4,
    hosts: Object.values(READERS).map((r) => r.host),
    async fetchJobs(http) {
      const list = watchlist();
      const jobs: DiscoveredJob[] = [];
      const notes: string[] = [];
      let dropped = 0;
      for (const { ats, slug } of list) {
        try {
          const got = await READERS[ats].read(http, encodeURIComponent(slug), (name) => ({ sourceId: 'ats', sourceName: name }));
          jobs.push(...got.jobs);
          dropped += got.dropped;
        } catch (err) {
          notes.push(`${ats}/${slug}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (list.length > 0 && notes.length === list.length) throw new Error(notes.join('; '));
      return notes.length ? { jobs, dropped, notes } : { jobs, dropped };
    },
  };
}
