import type { DiscoveredJob, JobSource } from '../../core/jobs/source';
import { decodeEntities, employmentFrom, htmlToText } from './normalize';

/** The text of one child element, CDATA or entity-encoded; '' when absent. */
const tag = (xml: string, name: string): string => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  const inner = m?.[1] ?? '';
  const cdata = inner.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cdata ? (cdata[1] ?? '') : decodeEntities(inner);
};

/**
 * We Work Remotely's public RSS feed: every job is remote, and titles read "Company: Role".
 * Credit: name the board and link to the job's page on it.
 * ponytail: a regex item reader, fine for this one flat feed; use an XML parser if a second feed needs namespaces or nesting.
 */
export const weWorkRemotely: JobSource = {
  id: 'wwr',
  name: 'We Work Remotely',
  dailyPollLimit: 4,
  hosts: ['weworkremotely.com'],
  async fetchJobs(http) {
    const xml = await http.getText('https://weworkremotely.com/remote-jobs.rss');
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const jobs: DiscoveredJob[] = [];
    let dropped = 0;
    for (const item of items) {
      const heading = tag(item, 'title').trim();
      const link = tag(item, 'link').trim();
      const posted = Date.parse(tag(item, 'pubDate'));
      const split = heading.indexOf(': ');
      if (split < 1 || !/^https:\/\/weworkremotely\.com\//.test(link) || Number.isNaN(posted)) {
        dropped++;
        continue;
      }
      jobs.push({
        sourceId: 'wwr',
        sourceName: 'We Work Remotely',
        externalId: tag(item, 'guid').trim() || link,
        company: heading.slice(0, split).trim(),
        title: heading.slice(split + 2).trim(),
        boardUrl: link,
        applyUrl: link,
        description: htmlToText(tag(item, 'description')),
        location: tag(item, 'region').trim() || 'Anywhere',
        postedAt: new Date(posted).toISOString(),
        tags: [tag(item, 'category').trim()].filter(Boolean),
        remote: true,
        employmentType: employmentFrom(tag(item, 'type')),
      });
    }
    return { jobs, dropped };
  },
};
