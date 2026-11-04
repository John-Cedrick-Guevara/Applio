import { describe, expect, it } from 'vitest';
import { matchRoute } from './router';

describe('matchRoute', () => {
  it('matches static paths', () => {
    expect(matchRoute('/jobs', '/jobs')).toEqual({});
  });

  it('extracts named params', () => {
    expect(matchRoute('/jobs/:id', '/jobs/j42')).toEqual({ id: 'j42' });
  });

  it('decodes params', () => {
    expect(matchRoute('/jobs/:id', '/jobs/a%20b')).toEqual({ id: 'a b' });
  });

  it('returns null on mismatch', () => {
    expect(matchRoute('/jobs/:id', '/jobs')).toBeNull();
    expect(matchRoute('/jobs', '/brain')).toBeNull();
  });

  it('ignores a trailing slash', () => {
    expect(matchRoute('/jobs', '/jobs/')).toEqual({});
  });
});
