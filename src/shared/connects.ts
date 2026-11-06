/**
 * The Connects an Upwork proposal costs, read from the pasted post (SPEC F5:
 * shown before the operator proceeds). Undefined when the post doesn't say;
 * Upwork's API, which would know, isn't available to a personal tool yet (SPEC §6).
 */
export function connectsCost(text: string): number | undefined {
  // "16 Connects", or "Connects … 8"; never just a number near "Connect" (a phone number, say).
  const match = /\b(\d{1,3})\s+Connects?\b/i.exec(text) ?? /\bConnects\b[^\d\n]{0,40}\b(\d{1,3})\b/i.exec(text);
  return match ? Number(match[1]) : undefined;
}
