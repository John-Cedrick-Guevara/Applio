import { describe, expect, it } from 'vitest';
import { meetsMinimumPay, parsePay } from './pay';

describe('parsePay', () => {
  it.each([
    ['$90k / year', { min: 90_000, max: 90_000, currency: 'USD' }],
    ['$120k–150k', { min: 120_000, max: 150_000, currency: 'USD' }],
    ['€150K – €250K • Offers Equity', { min: 150_000, max: 250_000, currency: 'EUR' }],
    ['USD 85,000–175,000', { min: 85_000, max: 175_000, currency: 'USD' }],
    ['€45 / hour', { min: 93_600, max: 93_600, currency: 'EUR' }],
    ['€5,000/month (full-time)', { min: 60_000, max: 60_000, currency: 'EUR' }],
    ['30,000 PHP / month', { min: 360_000, max: 360_000, currency: 'PHP' }],
    ['₱45,000 monthly', { min: 540_000, max: 540_000, currency: 'PHP' }],
    ['AUD 120k / year', { min: 120_000, max: 120_000, currency: 'AUD' }],
  ])('reads %s as a yearly range', (text, expected) => {
    expect(parsePay(text)).toEqual(expected);
  });

  it.each(['[Your minimum] / year or [rate] / hour', 'Competitive', '', '25'])('reads nothing from %j', (text) => {
    expect(parsePay(text)).toBeUndefined();
  });
});

describe('meetsMinimumPay', () => {
  it("drops a job whose top of range is below the operator's minimum", () => {
    expect(meetsMinimumPay('$60k–80k', '$90k / year')).toBe(false);
  });

  it('keeps a job whose top of range reaches the minimum', () => {
    expect(meetsMinimumPay('$70k–90k', '$90k / year')).toBe(true);
  });

  it('accepts either of two minimums, yearly or hourly', () => {
    expect(meetsMinimumPay('$50 / hour', '$120k / year or $45 / hour')).toBe(true);
  });

  it("keeps the job when either side can't be read, or the currencies differ", () => {
    expect(meetsMinimumPay(undefined, '$90k / year')).toBe(true);
    expect(meetsMinimumPay('$60k', '[Your minimum] / year')).toBe(true);
    expect(meetsMinimumPay('€40k', '$90k / year')).toBe(true);
  });

  it('never compares a PHP monthly minimum against a USD monthly job, so it is not dropped', () => {
    expect(meetsMinimumPay('USD 1,500 / month', '30,000 PHP / month')).toBe(true);
  });

  it('compares like with like once both sides name the currency', () => {
    expect(meetsMinimumPay('₱25,000 / month', '30,000 PHP / month')).toBe(false);
  });

  it('drops nothing on a minimum with no currency, since it could mean any of them (QA 2026-11-07 #9)', () => {
    expect(meetsMinimumPay('USD 1,500 / month', '30,000')).toBe(true);
    expect(meetsMinimumPay('$1,500 / month', '30,000 / month')).toBe(true);
  });
});
