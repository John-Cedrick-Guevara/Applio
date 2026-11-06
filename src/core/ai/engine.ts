/** What an engine returns for one prompt. */
export interface AiReply {
  text: string;
  /** Fresh input plus cache writes. */
  inputTokens: number;
  outputTokens: number;
  /** Input read from Claude's prompt cache, at about a tenth of the price. */
  cacheReadTokens?: number;
}

/**
 * What a reply costs against the token budget (SPEC F10): input and output in full,
 * cache reads at a tenth, their share of the price.
 */
export const budgetTokens = (reply: Pick<AiReply, 'inputTokens' | 'outputTokens' | 'cacheReadTokens'>) =>
  reply.inputTokens + reply.outputTokens + Math.ceil((reply.cacheReadTokens ?? 0) / 10);

/**
 * One way of reaching Claude: headless Claude Code or the Anthropic API (SPEC §2).
 * Both take the same request, so callers never know which one runs.
 */
export interface AiEngine {
  /** @throws when the engine can't run or Claude returns an error; the message is operator-readable. */
  /** `jobIds` are the jobs this call is about; Applio's tools refuse every other job. */
  /** `tools: false` runs the call without Applio's MCP tools: one turn, answer in the text. */
  complete(request: { system?: string; prompt: string; jobIds: readonly string[]; tools?: boolean }): Promise<AiReply>;
  /**
   * Whether the engine can run now and, if not, what the operator should do. Spends no tokens.
   * `command`: a terminal command that fixes it, e.g. signing in Applio's Claude Code profile.
   */
  check(): Promise<{ ready: boolean; message: string; command?: string }>;
}
