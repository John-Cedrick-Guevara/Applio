import { describe, expect, it } from 'vitest';
import { costLine } from './cost';

describe('costLine', () => {
  it("says the share of what's left today", () => {
    expect(costLine(8_000, { tokensToday: 82_000, dailyTokenBudget: 150_000 })).toBe('≈ 8k tokens · 12% of the 68k left today');
  });

  it('rounds a tiny share up to 1%, never 0%', () => {
    expect(costLine(500, { tokensToday: 0, dailyTokenBudget: 1_000_000 })).toBe('≈ 500 tokens · 1% of the 1M left today');
  });

  it('says when nothing is left', () => {
    expect(costLine(8_000, { tokensToday: 150_000, dailyTokenBudget: 150_000 })).toBe("≈ 8k tokens · nothing left today");
  });

  it('says when it is more than what is left', () => {
    expect(costLine(30_000, { tokensToday: 140_000, dailyTokenBudget: 150_000 })).toBe('≈ 30k tokens · more than the 10k left today');
  });
});
