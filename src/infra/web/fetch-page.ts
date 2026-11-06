import { htmlToText } from '../sources/normalize';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** Sites Applio never reads on its own (CLAUDE.md §1.2); for these the operator pastes the post. */
const PLATFORMS = ['linkedin.com', 'indeed.com', 'jobstreet.com', 'jobstreet.com.ph', 'upwork.com', 'facebook.com'];
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
};

/** Whether a link is on LinkedIn, Indeed, JobStreet, Upwork or Facebook (any subdomain, no look-alikes). */
export function isPlatformUrl(url: string): boolean {
  const host = hostOf(url);
  return PLATFORMS.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Reads one public job page the operator pasted a link to, as plain text (SPEC F2
 * Clip). Platform pages are never requested; the operator pastes those posts.
 * @throws with a next step when the link can't be used.
 */
export async function fetchPublicPage(url: string, fetch: Fetch): Promise<string> {
  let res: Response | undefined;
  let current = url;
  // Redirects are followed by hand, so every hop is checked: a short link must not lead onto a platform page.
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!current.startsWith('https://') || !hostOf(current)) throw new Error('Paste an https link, or the post itself.');
    if (isPlatformUrl(current)) throw new Error("Applio doesn't open pages on that site. Switch to Paste text and paste the whole post, link included.");
    try {
      res = await fetch(current, { redirect: 'manual', headers: { 'user-agent': 'Applio/0.1 (+https://github.com/John-Cedrick-Guevara/Applio)' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new Error("Couldn't load that page. Paste the post's text instead.");
    }
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!location) break;
    current = new URL(location, current).toString();
    res = undefined;
  }
  if (!res) throw new Error("That link redirects too many times. Paste the post's text instead.");
  if (!res.ok) throw new Error(`That page answered ${res.status}. Paste the post's text instead.`);
  if (!/text\/html|text\/plain/.test(res.headers.get('content-type') ?? '')) throw new Error("That link isn't a web page. Paste the post's text instead.");
  // A whole page, unlike a board's description: drop what never shows before reading the text.
  const body = (await res.text()).slice(0, MAX_BYTES).replace(/<(script|style|noscript|svg|head|template)\b[\s\S]*?<\/\1>/gi, '');
  return htmlToText(body);
}
