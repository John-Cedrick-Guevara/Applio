import { describe, expect, it } from 'vitest';
import { isAppUrl, isSafeExternalUrl } from './security';

describe('isAppUrl', () => {
  it('trusts the packaged renderer', () => {
    expect(isAppUrl('file:///Applications/Applio.app/dist/renderer/index.html#/review', undefined)).toBe(true);
  });

  it('trusts the dev server only in development', () => {
    expect(isAppUrl('http://localhost:5173/#/review', 'http://localhost:5173/')).toBe(true);
    expect(isAppUrl('http://localhost:5173/', undefined)).toBe(false);
  });

  it('rejects any other origin', () => {
    expect(isAppUrl('https://evil.example/', 'http://localhost:5173/')).toBe(false);
  });
});

describe('isSafeExternalUrl', () => {
  it('only opens web links in the system browser', () => {
    expect(isSafeExternalUrl('https://boards.greenhouse.io/x')).toBe(true);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
  });
});
