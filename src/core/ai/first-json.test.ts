import { describe, expect, it } from 'vitest';
import { firstJsonObject } from './first-json';

describe('firstJsonObject', () => {
  it('parses an object wrapped in prose or a code fence', () => {
    expect(firstJsonObject('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('returns undefined when there is no object or it is broken', () => {
    expect(firstJsonObject('no json here')).toBeUndefined();
    expect(firstJsonObject('{"a":')).toBeUndefined();
  });
});
