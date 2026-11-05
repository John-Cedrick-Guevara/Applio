/** What an engine returns for one prompt. Input tokens include cached ones, since they count against the budget. */
export interface AiReply {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * One way of reaching Claude: headless Claude Code or the Anthropic API (SPEC §2).
 * Both take the same request, so callers never know which one runs.
 */
export interface AiEngine {
  /** @throws when the engine can't run or Claude returns an error; the message is operator-readable. */
  complete(request: { system?: string; prompt: string }): Promise<AiReply>;
  /** Whether the engine can run now and, if not, what the operator should do. Spends no tokens. */
  check(): Promise<{ ready: boolean; message: string }>;
}
