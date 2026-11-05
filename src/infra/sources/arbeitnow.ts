import { z } from 'zod';
import type { JobSource } from '../../core/jobs/source';
import { decodeEntities, employmentFrom, htmlToText, isoFrom, parseItems } from './normalize';

const Item = z.object({
  slug: z.string().min(1),
  company_name: z.string(),
  title: z.string(),
  description: z.string(),
  remote: z.boolean(),
  url: z.url(),
  tags: z.array(z.string()).default([]),
  job_types: z.array(z.string()).default([]),
  location: z.string(),
  created_at: z.number(),
});

/**
 * Arbeitnow's free public API (newest 300). Its terms ask for a link back.
 * Many jobs are on-site; `remote` comes from the board and the prefilter decides.
 */
export const arbeitnow: JobSource = {
  id: 'arbeitnow',
  name: 'Arbeitnow',
  dailyPollLimit: 4,
  hosts: ['www.arbeitnow.com'],
  async fetchJobs(http) {
    const body = z.object({ data: z.array(z.unknown()) }).parse(await http.getJson('https://www.arbeitnow.com/api/job-board-api'));
    return parseItems(Item, body.data, (j) => ({
      sourceId: 'arbeitnow',
      sourceName: 'Arbeitnow',
      externalId: j.slug,
      company: decodeEntities(j.company_name).trim(),
      title: decodeEntities(j.title).trim(),
      boardUrl: j.url,
      applyUrl: j.url,
      description: htmlToText(j.description),
      location: j.location || 'Unknown',
      postedAt: isoFrom(j.created_at),
      tags: j.tags,
      remote: j.remote,
      employmentType: employmentFrom(j.job_types),
    }));
  },
};
