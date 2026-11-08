/** Phrasings planted in posts to steer automated tools, each with what it does in plain words. */
const PLANTED: [RegExp, string][] = [
  [/\b(?:ignore|disregard|forget|override)\b[^.\n]{0,30}\b(?:previous|prior|above|earlier|all|your)\b[^.\n]{0,20}\b(?:instructions?|prompts?|rules)\b/i, 'tells automated tools to ignore their instructions'],
  [/\b(?:note|message|instructions?|attention)\s*(?:for|to)?\s*:?\s*(?:all\s+|any\s+)?(?:ai|llms?|gpt|chatgpt|claude|language models?)\b(?:\s+(?:assistants?|agents?|tools?|models?))?\s*:/i, 'addresses AI tools directly'],
  [/\bif you are an? (?:ai|llm|language model|automated)/i, 'addresses AI tools directly'],
  [/\bsystem prompt\b/i, 'addresses AI tools directly'],
];

/**
 * Why a posting looks like it's trying to manipulate Applio's AI (QA 2026-11-07 #7),
 * or undefined when it reads as an ordinary post. Free and deterministic, so it runs
 * on every job; a match caps the job at the operator's own approval.
 * For email jobs, a request to send applications anywhere but the parsed apply
 * address is also suspicious, since the post can't change where Applio sends.
 */
export function suspiciousReason(text: string, applyTarget: string): string | undefined {
  for (const [pattern, reason] of PLANTED) if (pattern.test(text)) return `The post ${reason}.`;
  if (applyTarget.includes('@')) {
    const target = applyTarget.toLowerCase();
    // perf: one scan of each "send … to <address>" phrase; posts are capped at a few KB.
    for (const m of text.matchAll(/\b(?:send|forward|cc|bcc|email)\b[^.\n]{0,40}?\bto\b\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/gi)) {
      if (m[1]!.toLowerCase() !== target) return 'The post asks for applications at a different address than the one it lists.';
    }
  }
  return undefined;
}

