// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fetchPublicPage, isPlatformUrl } from './fetch-page';

const page = (html: string, type = 'text/html; charset=utf-8') => new Response(html, { status: 200, headers: { 'content-type': type } });

describe('fetchPublicPage', () => {
  it('reads a public job page as plain text', async () => {
    const fetch = vi.fn(async () => page('<html><body><h1>Backend Engineer</h1><p>Apply at <b>jobs@acme.com</b></p><script>x()</script></body></html>'));
    expect(await fetchPublicPage('https://careers.acme.com/jobs/1', fetch)).toBe('Backend Engineer\nApply at jobs@acme.com');
    expect(fetch).toHaveBeenCalledWith('https://careers.acme.com/jobs/1', expect.objectContaining({ redirect: 'manual' }));
  });

  it.each(['https://www.linkedin.com/jobs/view/1', 'https://ph.indeed.com/viewjob?jk=1', 'https://www.jobstreet.com.ph/job/1', 'https://www.upwork.com/jobs/~1', 'https://m.facebook.com/groups/1'])(
    'never requests a platform page: %s',
    async (url) => {
      const fetch = vi.fn();
      await expect(fetchPublicPage(url, fetch)).rejects.toThrow("Applio doesn't open pages on that site. Switch to Paste text and paste the whole post, link included.");
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

  it('follows a redirect to a public page, checking each hop', async () => {
    const fetch = vi.fn(async (url: string) =>
      url === 'https://bit.ly/x' ? new Response(null, { status: 301, headers: { location: 'https://careers.acme.com/jobs/1' } }) : page('<p>Engineer</p>'));
    expect(await fetchPublicPage('https://bit.ly/x', fetch)).toBe('Engineer');
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(['https://bit.ly/x', 'https://careers.acme.com/jobs/1']);
    expect(fetch).toHaveBeenCalledWith('https://bit.ly/x', expect.objectContaining({ redirect: 'manual' }));
  });

  it('never follows a redirect onto a platform page', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://www.linkedin.com/jobs/view/1' } }));
    await expect(fetchPublicPage('https://bit.ly/x', fetch)).rejects.toThrow("Applio doesn't open pages on that site. Switch to Paste text and paste the whole post, link included.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stops after a few redirects', async () => {
    const fetch = vi.fn(async (url: string) => new Response(null, { status: 302, headers: { location: `${url}x` } }));
    await expect(fetchPublicPage('https://a.com/', fetch)).rejects.toThrow("That link redirects too many times. Paste the post's text instead.");
    expect(fetch).toHaveBeenCalledTimes(6);
  });
});
