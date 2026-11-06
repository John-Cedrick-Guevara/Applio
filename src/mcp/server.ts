import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { ToolInputError, type McpTool } from './tools';

type Id = string | number;
interface Request { id?: Id; method?: unknown; params?: unknown }

const SERVER_INFO = { name: 'applio', version: '0.1.0' };
const FALLBACK_PROTOCOL = '2025-06-18';

/**
 * A minimal MCP server (SPEC §4): newline-delimited JSON-RPC 2.0 over the
 * streams Claude Code spawned it with, so nothing else can reach it. Only the
 * tools capability is offered. A tool's input error goes back as a tool result
 * with `isError`, so Claude can read it and retry.
 * @returns A promise that settles when the input closes.
 */
export function serveMcp(tools: readonly McpTool[], input: Readable, output: Writable): Promise<void> {
  const send = (msg: object) => output.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
  const fail = (id: Id, code: number, message: string) => send({ id, error: { code, message } });

  const handle = (req: Request) => {
    if (req.id === undefined) return; // a notification: nothing to answer
    const params = (req.params ?? {}) as Record<string, unknown>;
    switch (req.method) {
      case 'initialize': {
        const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : FALLBACK_PROTOCOL;
        return send({ id: req.id, result: { protocolVersion: asked, capabilities: { tools: {} }, serverInfo: SERVER_INFO } });
      }
      case 'ping':
        return send({ id: req.id, result: {} });
      case 'tools/list':
        return send({ id: req.id, result: { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } });
      case 'tools/call': {
        const tool = tools.find((t) => t.name === params.name);
        if (!tool) return fail(req.id, -32602, `Unknown tool: ${String(params.name)}`);
        try {
          return send({ id: req.id, result: { content: [{ type: 'text', text: tool.call(params.arguments) }], isError: false } });
        } catch (err) {
          if (err instanceof ToolInputError) return send({ id: req.id, result: { content: [{ type: 'text', text: err.message }], isError: true } });
          console.error(`[mcp] ${tool.name} failed`, err); // stderr: Claude Code shows it in its MCP log, never in stdout
          return send({ id: req.id, result: { content: [{ type: 'text', text: `${tool.name} failed inside Applio. Try again later.` }], isError: true } });
        }
      }
      default:
        return fail(req.id, -32601, `Method not found: ${String(req.method)}`);
    }
  };

  const lines = createInterface({ input });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    try {
      handle(JSON.parse(line) as Request);
    } catch {
      send({ id: null, error: { code: -32700, message: 'Parse error' } });
    }
  });
  return new Promise((resolve) => lines.on('close', () => resolve()));
}
