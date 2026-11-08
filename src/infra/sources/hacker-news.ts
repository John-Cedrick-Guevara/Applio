import { z } from 'zod';
import type { JobSource } from '../../core/jobs/source';
import { decodeEntities, htmlToText, isoFrom, parseItems } from './normalize';

const Search = z.object({ hits: z.array(z.object({ objectID: z.string(), title: z.string() })) });
const Comment = z.object({ id: z.number(), created_at_i: z.number(), text: z.string().min(1) });
const Thread = z.object({ children: z.array(z.unknown()) });

const URL_IN_TEXT = /\(?\bhttps?:\/\/\S+\)?|\(?\bwww\.\S+\)?/gi;

/** A company name without the web address posts often add ("Distru (https://distru.com)"); empty when nothing name-like is left. */
const companyName = (raw: string) => {
  const name = raw.replace(URL_IN_TEXT, ' ').replace(/\s+/g, ' ').trim();
  return name.length >= 2 && name.length <= 60 && /[a-z]{2}/i.test(name) ? name : '';
};

/**
 * The place field, cut where it runs into the post: HN's text loses line breaks, so
 * "Reno, NVWe build…" is cut at the glued capital, then at the first sentence end,
 * then to 80 characters on a word boundary.
 */
const placeOf = (raw: string) => {
  const glued = raw.search(/(?<=[a-zA-Z)])(?=[A-Z][a-z]+ [a-z])/);
  let place = glued > 0 ? raw.slice(0, glued) : raw;
  place = place.split(/(?<=[a-z)])\. /)[0]!;
  if (place.length > 80) place = place.slice(0, 81).replace(/\s+\S*$/, '');
  return place.trim();
};

/**
 * HN "Ask HN: Who is hiring?" via the official Algolia API: the newest monthly
 * thread, one job per top-level comment. Posts follow "Company | Role | Place | …"
 * by convention, so company and role come from that first line, verbatim; PR-16's
 * AI scoring reads the full text.
 */
export const hackerNews: JobSource = {
  id: 'hn',
  name: 'HN Who is hiring',
  // One thread a month; once a day is plenty.
  dailyPollLimit: 1,
  hosts: ['hn.algolia.com'],
  async fetchJobs(http) {
    const search = Search.parse(await http.getJson('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5'));
    const thread = search.hits.find((h) => h.title.startsWith('Ask HN: Who is hiring?'));
    if (!thread) return { jobs: [], dropped: 0, notes: ["This month's Who is hiring thread isn't up yet"] };
    const { children } = Thread.parse(await http.getJson(`https://hn.algolia.com/api/v1/items/${thread.objectID}`));
    return parseItems(Comment, children, (c) => {
      const text = htmlToText(c.text);
      const firstLine = text.split('\n')[0] ?? '';
      // Only a "Company | Role | Place" first line is trusted; anything else is left to the AI, which reads the whole post.
      const conventional = firstLine.includes('|');
      const [company = '', role = '', place = ''] = conventional ? firstLine.split('|').map((s) => decodeEntities(s).trim()) : [];
      const url = `https://news.ycombinator.com/item?id=${c.id}`;
      return {
        sourceId: 'hn',
        sourceName: 'HN Who is hiring',
        externalId: String(c.id),
        company: companyName(company) || 'Unknown company',
        title: role || 'See post',
        boardUrl: url,
        applyUrl: url,
        description: text,
        location: placeOf(place),
        postedAt: isoFrom(c.created_at_i),
        tags: [],
        remote: /\bremote\b/i.test(firstLine),
      };
    });
  },
};
