import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaContentBlock, BetaMessage, BetaMessageParam, BetaTool, BetaToolResultBlockParam, MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { AiEngine } from '../../core/ai/engine';
import { ToolInputError, type McpTool } from '../../mcp/tools';
import { EngineError } from './claude-code-engine';

/** Every step uses the current Opus; a cheaper model per step is the operator's call (spec Decisions). */
const MODEL = 'claude-opus-5-5';
const NO_KEY = 'Add your Anthropic API key below.';
/** Enough for a batch of tool calls and saves; past this Claude is looping. */
const MAX_TURNS = 12;

/** The part of the SDK client this engine uses, so tests can pass a fake. */
export interface ApiClient {
  beta: { messages: { create(params: MessageCreateParamsNonStreaming): Promise<BetaMessage> } };
  models: { retrieve(id: string): Promise<unknown> };
}

interface Options {
  /** Read from the keychain per call, so a newly saved key applies at once. */
  apiKey: () => string | undefined;
  client?: (apiKey: string) => ApiClient;
  /** Applio's tools for a call's jobs: the same handlers the MCP server runs (MCP MNB-2). */
  tools?: (jobIds: readonly string[]) => McpTool[];
}

/** Turns SDK failures into messages the operator can act on; the key never appears in them. */
const readable = (err: unknown): Error => {
  if (err instanceof Anthropic.AuthenticationError) return new EngineError('The Anthropic API rejected the key. Save it again below.', { cause: err });
  if (err instanceof Anthropic.RateLimitError) return new EngineError('The Anthropic API is rate-limiting this key. Applio tries again on the next run.', { cause: err });
  if (err instanceof Anthropic.APIConnectionError) return new EngineError("Couldn't reach the Anthropic API. Check the connection.", { cause: err });
  if (err instanceof Anthropic.APIError) return new EngineError(`The Anthropic API answered ${err.status ?? 'with an error'}.`, { cause: err });
  return err instanceof Error ? err : new Error(String(err));
};

/**
 * The fallback engine: the Anthropic API with the operator's own key (SPEC §2).
 * The key goes in the client's auth header only, never in the request body.
 */
/** Runs each tool call; a bad input goes back to Claude as an error result it can fix, never a crash. */
const runTools = (blocks: BetaContentBlock[], tools: readonly McpTool[]): BetaToolResultBlockParam[] =>
  blocks.flatMap((b): BetaToolResultBlockParam[] => {
    if (b.type !== 'tool_use') return [];
    const tool = tools.find((t) => t.name === b.name);
    try {
      if (!tool) throw new ToolInputError(`Unknown tool: ${b.name}`);
      return [{ type: 'tool_result', tool_use_id: b.id, content: tool.call(b.input), is_error: false }];
    } catch (err) {
      if (!(err instanceof ToolInputError)) console.error(`[ai] tool ${b.name} failed`, err);
      const content = err instanceof ToolInputError ? err.message : `${b.name} failed inside Applio. Try again later.`;
      return [{ type: 'tool_result', tool_use_id: b.id, content, is_error: true }];
    }
  });

export function createApiEngine({ apiKey, client = (key) => new Anthropic({ apiKey: key }), tools: toolsFor }: Options): AiEngine {
  const connect = () => {
    const key = apiKey();
    if (!key) throw new EngineError(NO_KEY);
    return client(key);
  };

  return {
    async complete({ system, prompt, jobIds }) {
      const api = connect();
      const tools = toolsFor?.(jobIds) ?? [];
      const definitions = tools.map((t): BetaTool => ({ name: t.name, description: t.description, input_schema: t.inputSchema as BetaTool['input_schema'] }));
      const messages: BetaMessageParam[] = [{ role: 'user', content: prompt }];
      let inputTokens = 0;
      let outputTokens = 0;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const reply = await api.beta.messages
          .create({
            model: MODEL,
            max_tokens: 16_000,
            // Opus 5.5 defaults to medium; say so, so a default change upstream can't shift spend.
            output_config: { effort: 'medium' },
            // On a policy decline, the API retries on a fallback model inside the same call.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            ...(system ? { system } : {}),
            ...(definitions.length > 0 ? { tools: definitions } : {}),
            messages: [...messages],
          })
          .catch((err: unknown) => Promise.reject(readable(err)));
        const u = reply.usage;
        inputTokens += u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        outputTokens += u.output_tokens;
        if (reply.stop_reason === 'refusal') throw new EngineError('Claude declined this request.');
        // A cut-off answer is incomplete JSON or a half-saved batch; better reported than used.
        if (reply.stop_reason === 'max_tokens') throw new EngineError("Claude's answer was cut off before it finished. Try again.");
        if (reply.stop_reason !== 'tool_use') {
          return { text: reply.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(''), inputTokens, outputTokens };
        }
        // The whole content goes back unchanged (thinking and fallback blocks included), then all results in one message.
        messages.push({ role: 'assistant', content: reply.content }, { role: 'user', content: runTools(reply.content, tools) });
      }
      throw new EngineError('Claude kept calling tools without finishing.');
    },

    async check() {
      let api: ApiClient;
      try {
        api = connect();
      } catch {
        return { ready: false, message: NO_KEY };
      }
      try {
        await api.models.retrieve(MODEL);
        return { ready: true, message: 'The Anthropic API accepted the key.' };
      } catch (err) {
        return { ready: false, message: readable(err).message };
      }
    },
  };
}
