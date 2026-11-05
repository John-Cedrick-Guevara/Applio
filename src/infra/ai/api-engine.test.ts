// @vitest-environment node
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { describe, expect, it, vi } from 'vitest';
import { createApiEngine, type ApiClient } from './api-engine';

const KEY = 'sk-ant-test-secret-123';

const message = (over: Partial<BetaMessage> = {}) =>
  ({
    content: [{ type: 'text', text: '{"score":82}', citations: null }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 40 },
    ...over,
  }) as BetaMessage;

/** A fake SDK client that records each request and the key it was built with. */
const setup = (answer: () => Promise<BetaMessage> = async () => message(), savedKey: () => string | undefined = () => KEY) => {
  const sent: MessageCreateParamsNonStreaming[] = [];
  const keys: string[] = [];
  const retrieve = vi.fn(async () => ({}));
  const client = (key: string): ApiClient => {
    keys.push(key);
    return {
      beta: { messages: { create: async (params) => (sent.push(params), answer()) } },
      models: { retrieve },
    };
  };
  return { engine: createApiEngine({ apiKey: savedKey, client }), sent, keys, retrieve };
};

describe('Anthropic API engine', () => {
  it('sends the request to the current Opus with the saved key and server-side refusal fallback', async () => {
    const { engine, sent, keys } = setup();
    await engine.complete({ system: 'You score jobs.', prompt: 'Score this' });
    expect(keys).toEqual([KEY]);
    expect(sent[0]).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: 'You score jobs.',
      messages: [{ role: 'user', content: 'Score this' }],
    });
  });

  it('returns the text and counts cached input tokens as input', async () => {
    expect(await setup().engine.complete({ prompt: 'x' })).toEqual({ text: '{"score":82}', inputTokens: 150, outputTokens: 40 });
  });

  it('never puts the key in the request it sends', async () => {
    const { engine, sent } = setup();
    await engine.complete({ system: 's', prompt: 'p' });
    expect(JSON.stringify(sent)).not.toContain(KEY);
  });

  it('reports a refusal instead of returning empty text', async () => {
    const { engine } = setup(async () => message({ stop_reason: 'refusal', content: [] }));
    await expect(engine.complete({ prompt: 'x' })).rejects.toThrow('Claude declined this request.');
  });

  it('says plainly when the key is rejected', async () => {
    const rejected = new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers());
    const { engine } = setup(async () => Promise.reject(rejected));
    await expect(engine.complete({ prompt: 'x' })).rejects.toThrow('The Anthropic API rejected the key. Save it again below.');
  });

  it('needs a saved key, and says so', async () => {
    const { engine } = setup(undefined, () => undefined);
    expect(await engine.check()).toEqual({ ready: false, message: 'Add your Anthropic API key below.' });
    await expect(engine.complete({ prompt: 'x' })).rejects.toThrow('Add your Anthropic API key below.');
  });

  it('checks the key with a model lookup, which spends no tokens', async () => {
    const { engine, retrieve, sent } = setup();
    expect(await engine.check()).toEqual({ ready: true, message: 'The Anthropic API accepted the key.' });
    expect(retrieve).toHaveBeenCalledWith('claude-opus-5-5');
    expect(sent).toEqual([]);
  });
});
