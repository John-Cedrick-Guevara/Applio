// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fetchPublicPage, isPlatformUrl } from './fetch-page';

const page = (html: string, type = 'text/html; charset=utf-8') => new Response(html, { status: 200, headers: { 'content-type': type } });

describe('fetchPublicPage', () => {
  it('reads a public job page as plain text', async () => {
    const fetch = vi.fn(async () => page('<html><body><h1>Backend Engineer</h1><p>Apply at <b>jobs@acme.com</b></p><script>x()</script></body></html>'));
    expect(await fetchPublicPage('https://careers.acme.com/jobs/1', fetch)).toBe('Backend Engineer\nApply at jobs@acme.com');
    expect(fetch).toHaveBeenCalledWith('https://careers.acme.com/jobs/1', expect.objectContaining({ redirect: 'follow' }));
  });

  it.each(['https://www.linkedin.com/jobs/view/1', 'https://ph.indeed.com/viewjob?jk=1', 'https://www.jobstreet.com.ph/job/1', 'https://www.upwork.com/jobs/~1', 'https://m.facebook.com/groups/1'])(
    'never requests a platform page: %s',
    async (url) => {
      const fetch = vi.fn();
      await expect(fetchPublicPage(url, fetch)).rejects.toThrow("Applio doesn't open pages on that site. Copy the post's text and paste it instead.");
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('refuses anything but an https link', async () => {
    const fetch = vi.fn();
    await expect(fetchPublicPage('http://acme.com/jobs', fetch)).rejects.toThrow('Paste an https link, or the post itself.');
    await expect(fetchPublicPage('file:///etc/passwd', fetch)).rejects.toThrow('Paste an https link, or the post itself.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says plainly when the page cannot be read', async () => {
    await expect(fetchPublicPage('https://acme.com/j', async () => new Response('', { status: 404 }))).rejects.toThrow("That page answered 404. Paste the post's text instead.");
    await expect(fetchPublicPage('https://acme.com/j', async () => page('%PDF', 'application/pdf'))).rejects.toThrow("That link isn't a web page. Paste the post's text instead.");
  });

  it('knows the platform hosts, subdomains included', () => {
    expect(isPlatformUrl('https://uk.linkedin.com/jobs')).toBe(true);
    expect(isPlatformUrl('https://linkedin.com.evil.net/jobs')).toBe(false);
  });
});
