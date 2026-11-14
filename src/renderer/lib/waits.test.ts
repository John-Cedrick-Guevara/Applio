import { describe, expect, it } from 'vitest';
import { stalledLine } from './waits';

const MIN = 60_000;

describe('stalledLine', () => {
  it('says nothing until about three times the usual time has passed', () => {
    expect(stalledLine('draft', 6 * MIN - 1)).toBeUndefined();
    expect(stalledLine('scan', 3 * MIN - 1)).toBeUndefined();
    expect(stalledLine('analyze', 90_000 - 1)).toBeUndefined();
  });

  it('says a draft is slow, for how long, the usual time, and what is safe', () => {
    expect(stalledLine('draft', 6 * MIN)).toEqual({
      title: 'Drafting is taking longer than usual.',
      body: 'It has run for 6 minutes. The usual time is 2. Nothing has been sent and the tokens used so far are logged. It still ends with a draft, or a note here saying what went wrong.',
    });
  });

  it('says a scan is slow and that what it found is kept', () => {
    expect(stalledLine('scan', 4 * MIN)).toEqual({
      title: 'The scan is taking longer than usual.',
      body: 'It has run for 4 minutes. The usual time is 1. Everything found so far is kept, and you can stop it.',
    });
  });

  it('says a match check is slow and that nothing was added', () => {
    expect(stalledLine('analyze', 100_000)?.body).toBe('It has run for 1 minute. The usual time is under a minute. Nothing was added and you can leave.');
  });

  it('says "1 minute" in the singular, and counts whole minutes', () => {
    expect(stalledLine('analyze', 90_000)?.body).toBe('It has run for 1 minute. The usual time is under a minute. Nothing was added and you can leave.');
    expect(stalledLine('analyze', 150_000)?.body).toMatch(/^It has run for 2 minutes\./);
  });

  it('says nothing for an elapsed time that is not a number, rather than "NaN minutes"', () => {
    expect(stalledLine('draft', Number.NaN)).toBeUndefined();
  });

  it('gives a scan that also drafts a longer usual time, since drafting takes minutes by itself', () => {
    expect(stalledLine('scanDraft', 5 * MIN)).toBeUndefined();
    expect(stalledLine('scanDraft', 9 * MIN)?.body).toBe('It has run for 9 minutes. The usual time is 3. Everything found so far is kept, and you can stop it.');
  });
});
