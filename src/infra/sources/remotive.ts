import { z } from 'zod';
import type { JobSource } from '../../core/jobs/source';
import { decodeEntities, employmentFrom, htmlToText, isoFrom, parseItems } from './normalize';

const Item = z.object({
  id: z.number(),
  url: z.url(),
  title: z.string(),
  company_name: z.string(),
  tags: z.array(z.string()).default([]),
  job_type: z.string().nullish(),
  publication_date: z.string(),
  candidate_required_location: z.string().nullish(),
  salary: z.string().nullish(),
  description: z.string(),
});

/**
 * Remotive's public API. Its terms: link back to the Remotive URL, name Remotive
 * as the source, and poll at most 4 times a day (jobs are delayed 24h anyway).
 */
export const remotive: JobSource = {
  id: 'remotive',
  name: 'Remotive',
  dailyPollLimit: 4,
  hosts: ['remotive.com'],
  async fetchJobs(http) {
    const body = z.object({ jobs: z.array(z.unknown()) }).parse(await http.getJson('https://remotive.com/api/remote-jobs'));
    return parseItems(Item, body.jobs, (j) => ({
      sourceId: 'remotive',
      sourceName: 'Remotive',
      externalId: String(j.id),
      company: decodeEntities(j.company_name).trim(),
      title: decodeEntities(j.title).trim(),
      boardUrl: j.url,
      // Remotive gives no separate apply link; its page holds the apply button.
      applyUrl: j.url,
      description: htmlToText(j.description),
      location: j.candidate_required_location || 'Worldwide',
      postedAt: isoFrom(j.publication_date),
      tags: j.tags,
      remote: true,
      salary: j.salary || undefined,
      employmentType: employmentFrom(j.job_type),
    }));
  },
};
