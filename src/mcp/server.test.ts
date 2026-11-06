// @vitest-environment node
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { serveMcp } from './server';
import { ToolInputError, type McpTool } from './tools';

const echo: McpTool = {
  name: 'echo',
  description: 'Echo',
  inputSchema: { type: 'object' },
  call: (input) => {
    if ((input as { fail?: boolean }).fail) throw new ToolInputError('Invalid input. fail: not allowed');
    return JSON.stringify(input);
  },
};

/** Talks to the server over in-memory streams, one JSON-RPC line at a time. */
const connect = () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const done = serveMcp([echo], input, output);
  const replies: unknown[] = [];
  let buffer = '';
  output.on('data', (c: Buffer) => {
    buffer += c.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const l of lines) replies.push(JSON.parse(l));
  });
  const send = async (msg: object) => {
    const before = replies.length;
    input.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
    if (!('id' in msg)) return undefined;
    await new Promise<void>((resolve) => {
      const wait = () => (replies.length > before ? resolve() : setTimeout(wait, 1));
      wait();
    });
    return replies.at(-1);
  };
  return { send, replies, raw: (line: string) => input.write(line + '\n'), close: () => input.end(), done };
};

describe('MCP server over stdio', () => {
  it('answers the initialize handshake with its tools capability', async () => {
    const { send } = connect();
    expect(await send({ id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'claude-code' } } })).toEqual({
      jsonrpc: '2.0', id: 1,
      result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'applio', version: '0.1.0' } },
    });
  });

  it('lists its tools', async () => {
    const { send } = connect();
    expect(await send({ id: 2, method: 'tools/list' })).toEqual({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'echo', description: 'Echo', inputSchema: { type: 'object' } }] } });
  });

  it('calls a tool and returns its text', async () => {
    const { send } = connect();
    expect(await send({ id: 3, method: 'tools/call', params: { name: 'echo', arguments: { a: 1 } } })).toEqual({
      jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: '{"a":1}' }], isError: false },
    });
  });

  it('returns a tool input error as a tool result Claude can read, not a protocol error', async () => {
    const { send } = connect();
    expect(await send({ id: 4, method: 'tools/call', params: { name: 'echo', arguments: { fail: true } } })).toEqual({
      jsonrpc: '2.0', id: 4, result: { content: [{ type: 'text', text: 'Invalid input. fail: not allowed' }], isError: true },
    });
  });

  it('rejects an unknown tool and an unknown method', async () => {
    const { send } = connect();
    expect(await send({ id: 5, method: 'tools/call', params: { name: 'shell', arguments: {} } })).toMatchObject({ id: 5, error: { code: -32602, message: 'Unknown tool: shell' } });
    expect(await send({ id: 6, method: 'resources/list' })).toMatchObject({ id: 6, error: { code: -32601 } });
  });

  it('ignores notifications and answers ping', async () => {
    const { send, replies } = connect();
    await send({ method: 'notifications/initialized' });
    expect(await send({ id: 7, method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 7, result: {} });
    expect(replies).toHaveLength(1);
  });

  it('answers a line that is not JSON with a parse error, then keeps serving', async () => {
    const { send, raw, replies } = connect();
    raw('not json');
    expect(await send({ id: 8, method: 'ping' })).toMatchObject({ id: 8 });
    expect(replies[0]).toMatchObject({ id: null, error: { code: -32700 } });
  });

  it('finishes when its input closes', async () => {
    const { close, done } = connect();
    close();
    await expect(done).resolves.toBeUndefined();
  });
});
