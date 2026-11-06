import { describe, expect, it } from 'vitest';
import { detectChannel } from './channel';

describe('detectChannel', () => {
  it.each([
    ['mailto:jobs@acme.com', { channel: 'email', applyTarget: 'jobs@acme.com' }],
    ['https://job-boards.greenhouse.io/gitlab/jobs/1', { channel: 'ats', applyTarget: 'job-boards.greenhouse.io' }],
    ['https://jobs.lever.co/acme/1', { channel: 'ats', applyTarget: 'jobs.lever.co' }],
    ['https://jobs.ashbyhq.com/acme/1', { channel: 'ats', applyTarget: 'jobs.ashbyhq.com' }],
    ['https://apply.workable.com/j/1', { channel: 'ats', applyTarget: 'apply.workable.com' }],
    ['https://www.linkedin.com/jobs/view/1', { channel: 'platform', applyTarget: 'Platform apply', platform: 'LinkedIn' }],
    ['https://www.upwork.com/jobs/~1', { channel: 'platform', applyTarget: 'Platform apply', platform: 'Upwork' }],
    ['https://careers.acme.com/1', { channel: 'custom', applyTarget: 'careers.acme.com' }],
  ] as const)('reads %s', (url, expected) => {
    expect(detectChannel(url)).toEqual(expected);
  });

  it('does not mistake a look-alike host for an ATS', () => {
    expect(detectChannel('https://greenhouse.io.evil.net/x').channel).toBe('custom');
  });

  it('treats an unparseable link as a custom site', () => {
    expect(detectChannel('not a url')).toEqual({ channel: 'custom', applyTarget: 'not a url' });
  });
});
