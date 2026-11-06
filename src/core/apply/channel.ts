import type { ApplyChannel } from '../../shared/types';

const ATS_DOMAINS = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com'];
const PLATFORMS: Record<string, string> = { 'linkedin.com': 'LinkedIn', 'indeed.com': 'Indeed', 'jobstreet.com': 'JobStreet', 'upwork.com': 'Upwork' };

/**
 * The page an ATS application form lives on (SPEC F5 channel 2). Lever, Ashby and
 * Workable put it one step after the job page; Greenhouse shows it on the job page.
 */
export function atsFormUrl(url: string): string {
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, '');
  const suffix = within(u.hostname, 'lever.co') || within(u.hostname, 'workable.com') ? '/apply' : within(u.hostname, 'ashbyhq.com') ? '/application' : '';
  u.pathname = suffix && !path.endsWith(suffix) ? path + suffix : path;
  return u.toString();
}

/** The host is the domain or one of its subdomains — never a look-alike such as `greenhouse.io.evil.net`. */
const within = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/**
 * Where an application goes, read from the job's apply link (SPEC F5). This
 * decides the channel's autonomy ceiling, so anything unknown is a custom site,
 * which is never autonomous.
 */
export function detectChannel(applyUrl: string): { channel: ApplyChannel; applyTarget: string; platform?: string } {
  if (applyUrl.startsWith('mailto:')) return { channel: 'email', applyTarget: applyUrl.slice(7).split('?')[0] ?? '' };
  let host: string;
  try {
    host = new URL(applyUrl).hostname.toLowerCase();
  } catch {
    return { channel: 'custom', applyTarget: applyUrl };
  }
  if (ATS_DOMAINS.some((d) => within(host, d))) return { channel: 'ats', applyTarget: host };
  const platform = Object.entries(PLATFORMS).find(([d]) => within(host, d))?.[1];
  if (platform) return { channel: 'platform', applyTarget: 'Platform apply', platform };
  return { channel: 'custom', applyTarget: host };
}
