import { describe, expect, it } from 'vitest';
import { connectsCost } from './connects';

describe('connectsCost', () => {
  it.each([
    ['Send a proposal for: 16 Connects', 16],
    ['Required Connects to submit a proposal: 8', 8],
    ['This job costs 1 Connect', 1],
    ['No mention here', undefined],
  ])('reads %j', (text, cost) => {
    expect(connectsCost(text)).toBe(cost);
  });
});
