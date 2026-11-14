import { describe, expect, it } from 'vitest';
import { costBlocks, costLine } from './cost';

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

describe('costBlocks', () => {
  const status = (tokensToday: number) => ({ tokensToday, dailyTokenBudget: 150_000 });

  it('fills at least one block for any cost, and rounds a share up to the next tenth', () => {
    expect(costBlocks(6_000, status(82_000))).toBe(1); // 6k of 68k: 9%
    expect(costBlocks(6_000, status(130_000))).toBe(3); // 6k of 20k: 30%
    expect(costBlocks(6_100, status(130_000))).toBe(4); // just over 30%
  });

  it('is full when the cost reaches what is left, or when nothing is left', () => {
    expect(costBlocks(20_000, status(130_000))).toBe(10);
    expect(costBlocks(30_000, status(140_000))).toBe(10);
    expect(costBlocks(6_000, status(150_000))).toBe(10);
  });

  it('is full when AI is stopped by a budget, even with tokens left', () => {
    expect(costBlocks(6_000, { ...status(82_000), budgetStop: 'Monthly budget used' })).toBe(10);
  });
});
