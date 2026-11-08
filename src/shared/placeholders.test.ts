import { describe, expect, it } from 'vitest';
import { findPlaceholder } from './placeholders';

describe('findPlaceholder', () => {
  it('finds a bracketed template placeholder', () => {
    expect(findPlaceholder('Best,\n[Your Name]')).toBe('[Your Name]');
  });

  it('finds none in finished text', () => {
    expect(findPlaceholder('Best,\nSam Rivera')).toBeUndefined();
  });

  it('ignores brackets that span lines, which are not placeholders', () => {
    expect(findPlaceholder('see [1\n2]')).toBeUndefined();
  });
});
