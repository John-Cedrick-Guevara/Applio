const MIN = 60_000;

/** A wait that can run long: how long it usually takes and the line past which it is "taking longer than usual". */
interface WaitRule {
  title: string;
  /** The usual time, in words, as the States kit gives it. */
  usual: string;
  /** About three times the usual time. */
  limitMs: number;
  /** What is safe, so a slow wait never leaves the operator wondering. */
  safe: string;
}

const RULES = {
  draft: { title: 'Drafting is taking longer than usual.', usual: '2', limitMs: 6 * MIN, safe: 'Nothing has been sent and the tokens used so far are logged.' },
  scan: { title: 'The scan is taking longer than usual.', usual: '1', limitMs: 3 * MIN, safe: 'Everything found so far is kept, and you can stop it.' },
  analyze: { title: 'Checking the match is taking longer than usual.', usual: 'under a minute', limitMs: 90_000, safe: 'Nothing was added and you can leave.' },
} as const satisfies Record<string, WaitRule>;

export type WaitKind = keyof typeof RULES;

const minutes = (ms: number) => {
  const n = Math.round(ms / MIN);
  return `${n} minute${n === 1 ? '' : 's'}`;
};

/**
 * What to say when a wait has run about three times as long as usual (States kit): that it is
 * slow, for how long, the usual time and what is safe. Nothing before then, and never a spinner
 * with no end.
 * @returns The note, or undefined while the wait is still within its usual range.
 */
export function stalledLine(kind: WaitKind, elapsedMs: number): { title: string; body: string } | undefined {
  const rule = RULES[kind];
  if (elapsedMs < rule.limitMs) return undefined;
  return { title: rule.title, body: `It has run for ${minutes(elapsedMs)}. The usual time is ${rule.usual}. ${rule.safe}` };
}
