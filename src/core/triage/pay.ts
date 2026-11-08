/** A pay range, annualized so hourly, monthly and yearly figures compare. */
export interface PayRange {
  min: number;
  max: number;
  currency?: string;
}

const HOURS_PER_YEAR = 2080;
/** Bare numbers at least this big read as yearly; smaller ones are ambiguous without a period. */
const YEARLY_FLOOR = 10_000;

/** ISO codes Applio reads, written out ("PHP 30,000") or by symbol. A code wins over a symbol ("A$" is still AUD by code only). */
const CODES = /\b(USD|EUR|GBP|PHP|AUD|CAD|SGD|INR|JPY|NZD|CHF)\b/i;
const SYMBOLS: [RegExp, string][] = [[/₱/, 'PHP'], [/€/, 'EUR'], [/£/, 'GBP'], [/₹/, 'INR'], [/\$/, 'USD']];

const currencyOf = (text: string): string | undefined =>
  CODES.exec(text)?.[1]?.toUpperCase() ?? SYMBOLS.find(([re]) => re.test(text))?.[1];

const perYear = (text: string, max: number): number | undefined => {
  if (/\b(hour|hourly|hr)\b|\/\s*h\b/i.test(text)) return HOURS_PER_YEAR;
  if (/\b(month|monthly|mo)\b/i.test(text)) return 12;
  if (/\b(year|yearly|annual|annually|annum|yr)\b|\/\s*y\b/i.test(text) || max >= YEARLY_FLOOR) return 1;
  return undefined;
};

/**
 * Reads free-text pay ("$120k–150k", "€45 / hour", "USD 85,000–175,000") as a yearly range.
 * @returns undefined when there's no number, or no way to tell the period.
 */
export function parsePay(text: string): PayRange | undefined {
  const values = [...text.matchAll(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kK])?/g)]
    .map(([, n = '', k]) => Number(n.replace(/,/g, '')) * (k ? 1000 : 1))
    .filter((v) => v > 0);
  if (values.length === 0) return undefined;
  const [min, max] = [Math.min(...values), Math.max(...values)];
  const factor = perYear(text, max);
  if (factor === undefined) return undefined;
  return { min: min * factor, max: max * factor, ...(currencyOf(text) ? { currency: currencyOf(text) } : {}) };
}

/**
 * True unless the job's pay is clearly below the operator's minimum: its top of
 * range is compared, yearly, against the lowest of the operator's alternatives
 * ("$120k / year or $45 / hour"). Unreadable pay, mismatched currencies, or a
 * minimum with no currency (which could mean any of them) keep the job (SPEC F3:
 * only drop what we're sure about).
 */
export function meetsMinimumPay(jobSalary: string | undefined, minimumPay: string): boolean {
  const job = parsePay(jobSalary ?? '');
  if (!job) return true;
  const minimums = minimumPay
    .split(/\bor\b/i)
    .map(parsePay)
    .filter((p): p is PayRange => !!p?.currency && (!job.currency || p.currency === job.currency));
  if (minimums.length === 0) return true;
  return job.max >= Math.min(...minimums.map((m) => m.min));
}
