import { z } from 'zod';
import type { JobSource } from '../../core/jobs/source';
import { decodeEntities, htmlToText, isoFrom, parseItems, repairMojibake } from './normalize';

const Item = z.object({
  id: z.coerce.string().min(1),
  company: z.string(),
  position: z.string(),
  description: z.string(),
  location: z.string(),
  url: z.url(),
  apply_url: z.url(),
  date: z.string(),
  tags: z.array(z.string()).default([]),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
});

/**
 * Remote OK's public JSON API. Its terms: link back to the job's Remote OK URL
 * and name "Remote OK" as the source; don't use the logo (SPEC F2). Its text is
 * double-encoded UTF-8, so every string goes through `repairMojibake`.
 */
export const remoteOk: JobSource = {
  id: 'remoteok',
  name: 'Remote OK',
  dailyPollLimit: 4,
  hosts: ['remoteok.com'],
  async fetchJobs(http) {
    const body = z.array(z.unknown()).parse(await http.getJson('https://remoteok.com/api'));
    // The first element is the API's legal notice, not a job.
    const items = body.filter((item) => !(item && typeof item === 'object' && 'legal' in item));
    const text = (s: string) => decodeEntities(repairMojibake(s)).trim();
    return parseItems(Item, items, (j) => {
      const description = htmlToText(repairMojibake(j.description));
      // Remote OK pads tags with SEO terms ("salesforce, hr, recruiter" on a full-stack role); keep only ones the post mentions.
      const mentioned = (tag: string) => new RegExp(`\\b${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(description);
      return {
      sourceId: 'remoteok',
      sourceName: 'Remote OK',
      externalId: j.id,
      company: text(j.company),
      title: text(j.position),
      boardUrl: j.url,
      applyUrl: j.apply_url,
      description,
      location: text(j.location) || 'Worldwide',
      postedAt: isoFrom(j.date),
      tags: j.tags.map(text).filter(mentioned),
      remote: true,
      salary: j.salary_min && j.salary_max ? `$${j.salary_min.toLocaleString('en-US')}–$${j.salary_max.toLocaleString('en-US')}` : undefined,
      };
    });
  },
};
