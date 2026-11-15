// @vitest-environment node
import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessage, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { describe, expect, it, vi } from 'vitest';
import { ToolInputError, type McpTool } from '../../mcp/tools';
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
const echo: McpTool = {
  name: 'get_jobs', description: 'Jobs', inputSchema: { type: 'object', properties: {} },
  call: (input) => {
    if ((input as { bad?: boolean }).bad) throw new ToolInputError('Invalid input. bad: not allowed');
    return '[{"id":"j1"}]';
  },
};

const setup = (answer: () => Promise<BetaMessage> = async () => message(), savedKey: () => string | undefined = () => KEY, tools?: (ids: readonly string[]) => McpTool[]) => {
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
  return { engine: createApiEngine({ apiKey: savedKey, client, ...(tools ? { tools } : {}) }), sent, keys, retrieve };
};

describe('Anthropic API engine', () => {
  it('sends the request to the current Opus with the saved key and server-side refusal fallback', async () => {
    const { engine, sent, keys } = setup();
    await engine.complete({ system: 'You score jobs.', prompt: 'Score this', jobIds: [] });
    expect(keys).toEqual([KEY]);
    expect(sent[0]).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: 'You score jobs.', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: 'Score this' }],
    });
  });

  it('returns the text, with cache reads apart from fresh input and cache writes', async () => {
    expect(await setup().engine.complete({ prompt: 'x', jobIds: [] })).toEqual({ text: '{"score":82}', inputTokens: 120, outputTokens: 40, cacheReadTokens: 30 });
  });

  it('never puts the key in the request it sends', async () => {
    const { engine, sent } = setup();
    await engine.complete({ system: 's', prompt: 'p', jobIds: [] });
    expect(JSON.stringify(sent)).not.toContain(KEY);
  });

  it('reports a refusal instead of returning empty text', async () => {
    const { engine } = setup(async () => message({ stop_reason: 'refusal', content: [] }));
    await expect(engine.complete({ prompt: 'x', jobIds: [] })).rejects.toThrow('Claude declined this request.');
  });

  it('says plainly when the key is rejected', async () => {
    const rejected = new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers());
    const { engine } = setup(async () => Promise.reject(rejected));
    await expect(engine.complete({ prompt: 'x', jobIds: [] })).rejects.toThrow('The Anthropic API rejected the key. Save it again below.');
  });

  it('needs a saved key, and says so', async () => {
    const { engine } = setup(undefined, () => undefined);
    expect(await engine.check()).toEqual({ ready: false, message: 'Add your Anthropic API key below.' });
    await expect(engine.complete({ prompt: 'x', jobIds: [] })).rejects.toThrow('Add your Anthropic API key below.');
  });

  it('refuses a web read, which only Claude Code can do, without calling the API', async () => {
    const { engine, sent } = setup();
    await expect(engine.complete({ prompt: 'x', jobIds: [], tools: false, webRead: 'https://jane.dev' })).rejects.toThrow('Claude Code');
    expect(sent).toHaveLength(0);
  });

  it('checks the key with a model lookup, which spends no tokens', async () => {
    const { engine, retrieve, sent } = setup();
    expect(await engine.check()).toEqual({ ready: true, message: 'The Anthropic API accepted the key.' });
    expect(retrieve).toHaveBeenCalledWith('claude-opus-5-5');
    expect(sent).toEqual([]);
  });

  it("runs Applio's tools for Claude, scoped to the call's jobs, and adds up every turn's tokens", async () => {
    const turns = [
      message({ stop_reason: 'tool_use', content: [
        { type: 'tool_use', id: 't1', name: 'get_jobs', input: {} },
        { type: 'tool_use', id: 't2', name: 'get_jobs', input: { bad: true } },
      ] } as Partial<BetaMessage>),
      message(),
    ];
    const scopes: (readonly string[])[] = [];
    const { engine, sent } = setup(async () => turns.shift()!, () => KEY, (ids) => (scopes.push(ids), [echo]));
    expect(await engine.complete({ prompt: 'Score', jobIds: ['j1'] })).toEqual({ text: '{"score":82}', inputTokens: 240, outputTokens: 80, cacheReadTokens: 60 });
    expect(scopes).toEqual([['j1']]);
    expect(sent[0]!.tools).toEqual([{ name: 'get_jobs', description: 'Jobs', input_schema: { type: 'object', properties: {} } }]);
    expect(sent[1]!.messages.at(-1)).toEqual({ role: 'user', content: [
      { type: 'tool_result', tool_use_id: 't1', content: '[{"id":"j1"}]', is_error: false },
      { type: 'tool_result', tool_use_id: 't2', content: 'Invalid input. bad: not allowed', is_error: true },
    ] });
  });

  it('stops a tool loop that never ends', async () => {
    const loop = () => message({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't', name: 'get_jobs', input: {} }] } as Partial<BetaMessage>);
    const { engine, sent } = setup(async () => loop(), () => KEY, () => [echo]);
    await expect(engine.complete({ prompt: 'x', jobIds: [] })).rejects.toThrow('Claude kept calling tools without finishing.');
    expect(sent).toHaveLength(12);
  });

  it('reports an answer cut off at the output limit instead of using it', async () => {
    const { engine } = setup(async () => message({ stop_reason: 'max_tokens' }));
    await expect(engine.complete({ prompt: 'x', jobIds: [] })).rejects.toThrow("Claude's answer was cut off before it finished. Try again.");
  });

  it('marks the system prompt for caching, so the fixed prefix is read cheaply on later calls', async () => {
    const { engine, sent } = setup();
    await engine.complete({ system: 'PREFIX', prompt: 'x', jobIds: [] });
    expect(sent[0]!.system).toEqual([{ type: 'text', text: 'PREFIX', cache_control: { type: 'ephemeral' } }]);
  });

  it('offers no tools on a tool-free call', async () => {
    const { engine, sent } = setup(undefined, () => KEY, () => [echo]);
    await engine.complete({ prompt: 'x', jobIds: ['j1'], tools: false });
    expect(sent[0]!.tools).toBeUndefined();
  });
});
