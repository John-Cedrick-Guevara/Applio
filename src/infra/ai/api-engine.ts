import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { AiEngine } from '../../core/ai/engine';
import { EngineError } from './claude-code-engine';

/** Every step uses the current Opus; a cheaper model per step is the operator's call (spec Decisions). */
const MODEL = 'claude-opus-5-5';
const NO_KEY = 'Add your Anthropic API key below.';

/** The part of the SDK client this engine uses, so tests can pass a fake. */
export interface ApiClient {
  beta: { messages: { create(params: MessageCreateParamsNonStreaming): Promise<BetaMessage> } };
  models: { retrieve(id: string): Promise<unknown> };
}

interface Options {
  /** Read from the keychain per call, so a newly saved key applies at once. */
  apiKey: () => string | undefined;
  client?: (apiKey: string) => ApiClient;
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
export function createApiEngine({ apiKey, client = (key) => new Anthropic({ apiKey: key }) }: Options): AiEngine {
  const connect = () => {
    const key = apiKey();
    if (!key) throw new EngineError(NO_KEY);
    return client(key);
  };

  return {
    async complete({ system, prompt }) {
      const api = connect();
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
          messages: [{ role: 'user', content: prompt }],
        })
        .catch((err: unknown) => Promise.reject(readable(err)));
      if (reply.stop_reason === 'refusal') throw new EngineError('Claude declined this request.');
      const u = reply.usage;
      return {
        text: reply.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join(''),
        inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        outputTokens: u.output_tokens,
      };
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
