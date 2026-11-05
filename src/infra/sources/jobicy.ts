import { z } from 'zod';
import type { JobSource } from '../../core/jobs/source';
import { decodeEntities, employmentFrom, htmlToText, isoFrom, parseItems } from './normalize';

const Item = z.object({
  id: z.number(),
  url: z.url(),
  jobTitle: z.string(),
  companyName: z.string(),
  jobIndustry: z.array(z.string()).default([]),
  jobType: z.array(z.string()).default([]),
  jobGeo: z.string().nullish(),
  jobDescription: z.string(),
  pubDate: z.string(),
});

/**
 * Jobicy's public API. Its terms: credit Jobicy with a direct link, and every
 * apply button must go to the original job URL from the feed.
 */
export const jobicy: JobSource = {
  id: 'jobicy',
  name: 'Jobicy',
  dailyPollLimit: 4,
  hosts: ['jobicy.com'],
  async fetchJobs(http) {
    const body = z.object({ jobs: z.array(z.unknown()) }).parse(await http.getJson('https://jobicy.com/api/v2/remote-jobs?count=50'));
    return parseItems(Item, body.jobs, (j) => ({
      sourceId: 'jobicy',
      sourceName: 'Jobicy',
      externalId: String(j.id),
      company: decodeEntities(j.companyName).trim(),
      title: decodeEntities(j.jobTitle).trim(),
      boardUrl: j.url,
      applyUrl: j.url,
      description: htmlToText(j.jobDescription),
      location: j.jobGeo || 'Worldwide',
      postedAt: isoFrom(j.pubDate),
      tags: j.jobIndustry.map(decodeEntities),
      remote: true,
      employmentType: employmentFrom(j.jobType),
    }));
  },
};
