import { describe, expect, it } from 'vitest';
import { denyAndOpenExternally, guardNavigation, isAppUrl, isSafeExternalUrl } from './security';

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

describe('denyAndOpenExternally', () => {
  it('never opens a second app window and sends web links to the system browser', () => {
    const opened: string[] = [];
    const handler = denyAndOpenExternally((url) => opened.push(url));
    expect(handler({ url: 'https://example.com/job' })).toEqual({ action: 'deny' });
    expect(handler({ url: 'file:///etc/passwd' })).toEqual({ action: 'deny' });
    expect(opened).toEqual(['https://example.com/job']);
  });
});

describe('guardNavigation', () => {
  const event = () => {
    const e = { prevented: false, preventDefault: () => { e.prevented = true; } };
    return e;
  };

  it('lets the app navigate within itself', () => {
    const e = event();
    guardNavigation('http://localhost:5173/', () => {})(e, 'http://localhost:5173/#/review');
    expect(e.prevented).toBe(false);
  });

  it('blocks leaving the app and hands web links to the system browser', () => {
    const opened: string[] = [];
    const e = event();
    guardNavigation(undefined, (url) => opened.push(url))(e, 'https://evil.example/');
    expect(e.prevented).toBe(true);
    expect(opened).toEqual(['https://evil.example/']);
  });

  it('blocks non-web schemes without opening anything', () => {
    const opened: string[] = [];
    const e = event();
    guardNavigation(undefined, (url) => opened.push(url))(e, 'javascript:alert(1)');
    expect(e.prevented).toBe(true);
    expect(opened).toEqual([]);
  });
});
