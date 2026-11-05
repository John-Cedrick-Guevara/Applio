import { z } from 'zod';
import type { JobSource } from '../../core/jobs/source';
import { decodeEntities, employmentFrom, htmlToText, isoFrom, parseItems } from './normalize';

const Item = z.object({
  guid: z.url(),
  title: z.string(),
  companyName: z.string(),
  employmentType: z.string().nullish(),
  minSalary: z.number().nullish(),
  maxSalary: z.number().nullish(),
  currency: z.string().nullish(),
  locationRestrictions: z.array(z.string()).default([]),
  timezoneRestrictions: z.array(z.number()).default([]),
  categories: z.array(z.string()).default([]),
  description: z.string(),
  pubDate: z.number(),
  applicationLink: z.url(),
});

/**
 * Himalayas' public jobs API: newest first, every job remote.
 * ponytail: reads the first page only (newest 20); follow `nextCursor` if 6-hourly polls start missing jobs.
 */
export const himalayas: JobSource = {
  id: 'himalayas',
  name: 'Himalayas',
  dailyPollLimit: 4,
  hosts: ['himalayas.app'],
  async fetchJobs(http) {
    const body = z.object({ jobs: z.array(z.unknown()) }).parse(await http.getJson('https://himalayas.app/jobs/api?limit=20'));
    return parseItems(Item, body.jobs, (j) => ({
      sourceId: 'himalayas',
      sourceName: 'Himalayas',
      externalId: j.guid,
      company: decodeEntities(j.companyName).trim(),
      title: decodeEntities(j.title).trim(),
      boardUrl: j.guid,
      applyUrl: j.applicationLink,
      description: htmlToText(j.description),
      location: j.locationRestrictions.join(', ') || 'Worldwide',
      postedAt: isoFrom(j.pubDate),
      tags: j.categories,
      remote: true,
      salary: j.minSalary && j.maxSalary ? `${j.currency ?? ''} ${j.minSalary.toLocaleString('en-US')}–${j.maxSalary.toLocaleString('en-US')}`.trim() : undefined,
      employmentType: employmentFrom(j.employmentType),
      ...(j.timezoneRestrictions.length ? { utcOffsets: j.timezoneRestrictions } : {}),
    }));
  },
};
