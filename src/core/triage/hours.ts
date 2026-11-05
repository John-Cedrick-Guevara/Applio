/** "At least 4h with UTC−5 to UTC+2": how many shared hours, with teams in which UTC offsets. */
export interface HoursPreference {
  hours: number;
  from: number;
  to: number;
}

const WORKDAY = 8;
const DEFAULT_HOURS = 4;
const OFFSET = /\b(?:UTC|GMT)\s*([+\-−–]\s*\d{1,2})?/gi;

const offsetsIn = (text: string): number[] =>
  [...text.matchAll(OFFSET)].map(([, sign]) => (sign ? Number(sign.replace(/\s/g, '').replace(/[−–]/, '-')) : 0));

/** @returns undefined unless the text names a UTC range; hours default to 4. */
export function parseHoursPreference(text: string): HoursPreference | undefined {
  const [a, b] = offsetsIn(text);
  if (a === undefined || b === undefined) return undefined;
  const hours = Number(text.match(/(\d+)\s*(?:h\b|hours?)/i)?.[1] ?? DEFAULT_HOURS);
  return { hours, from: Math.min(a, b), to: Math.max(a, b) };
}

/**
 * The UTC offsets a job says it works in: from the board when it gives them,
 * else a "UTC−3 to UTC+1" / "GMT+8" in the location. Undefined when it says nothing.
 */
export function jobOffsets(job: { location: string; utcOffsets?: readonly number[] }): number[] | undefined {
  if (job.utcOffsets?.length) return [...job.utcOffsets];
  const [a, b] = offsetsIn(job.location);
  if (a === undefined) return undefined;
  if (b === undefined) return [a];
  return Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);
}

/** Hours between two offsets around the clock (UTC+14 is next to UTC−10). */
const apart = (x: number, y: number) => Math.min(Math.abs(x - y), 24 - Math.abs(x - y));

/**
 * True if any of the job's offsets is close enough to the operator's range to
 * share the required hours of an 8-hour working day.
 */
export function canOverlap(offsets: readonly number[], pref: HoursPreference): boolean {
  return offsets.some((o) => {
    const distance = o >= pref.from && o <= pref.to ? 0 : Math.min(apart(o, pref.from), apart(o, pref.to));
    return WORKDAY - distance >= pref.hours;
  });
}
