import { z } from 'zod';
import type { JobSource } from '../../core/jobs/source';
import { decodeEntities, htmlToText, isoFrom, parseItems } from './normalize';

const Search = z.object({ hits: z.array(z.object({ objectID: z.string(), title: z.string() })) });
const Comment = z.object({ id: z.number(), created_at_i: z.number(), text: z.string().min(1) });
const Thread = z.object({ children: z.array(z.unknown()) });

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
      const [company = '', role = '', place = ''] = firstLine.split('|').map((s) => decodeEntities(s).trim());
      const url = `https://news.ycombinator.com/item?id=${c.id}`;
      return {
        sourceId: 'hn',
        sourceName: 'HN Who is hiring',
        externalId: String(c.id),
        company: company || 'Unknown company',
        title: role || 'See post',
        boardUrl: url,
        applyUrl: url,
        description: text,
        location: place,
        postedAt: isoFrom(c.created_at_i),
        tags: [],
        remote: /\bremote\b/i.test(firstLine),
      };
    });
  },
};
