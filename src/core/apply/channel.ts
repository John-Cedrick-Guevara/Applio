import type { ApplyChannel } from '../../shared/types';

const ATS_DOMAINS = ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com'];
const PLATFORMS: Record<string, string> = { 'linkedin.com': 'LinkedIn', 'indeed.com': 'Indeed', 'jobstreet.com': 'JobStreet', 'upwork.com': 'Upwork' };

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
