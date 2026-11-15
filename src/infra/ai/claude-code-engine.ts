import { spawn } from 'node:child_process';
import type { AiEngine } from '../../core/ai/engine';
import { AppError } from '../../shared/errors';

const NOT_INSTALLED = "Claude Code isn't installed. Install it from claude.com/claude-code, or switch to an Anthropic API key below.";
const NOT_SIGNED_IN = "Claude Code isn't signed in for Applio yet. Run this once in a terminal, then click Test: it opens your browser to sign in with the same account. Or switch to an Anthropic API key below.";
const TIMEOUT_MS = 10 * 60_000;

/** Claude Code couldn't run or returned an error. The message is for the operator. */
export class EngineError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super('engine_failed', message, options);
  }
}

interface Options {
  /** The `claude` binary, found on `env.PATH` when not a path. */
  command: string;
  /** Somewhere with no project files, so no `CLAUDE.md` or project settings load. */
  cwd: string;
  /**
   * Applio's own Claude Code profile (`CLAUDE_CONFIG_DIR`): the operator's personal hooks,
   * plugins, skills, settings and memory live in their own profile and never load here.
   */
  configDir: string;
  env: NodeJS.ProcessEnv;
  /** Applio's MCP config as JSON for these jobs; nothing else is loaded (`--strict-mcp-config`). */
  mcpConfig: (jobIds: readonly string[]) => string;
}

/**
 * Runs the binary, feeding `stdin`, and resolves its output once it exits. A
 * non-zero exit still resolves: Claude Code puts the reason (logged out, API
 * error) in its stdout, so callers read that before giving up.
 */
const run = ({ command, cwd, env, configDir }: Options, args: string[], stdin: string) =>
  new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...env, CLAUDE_CONFIG_DIR: configDir }, stdio: ['pipe', 'pipe', 'pipe'], timeout: TIMEOUT_MS });
    let out = '';
    let err = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString()));
    child.stderr.on('data', (c: Buffer) => (err += c.toString()));
    child.on('error', (e: NodeJS.ErrnoException) => reject(new EngineError(e.code === 'ENOENT' ? NOT_INSTALLED : `Claude Code couldn't start: ${e.message}`, { cause: e })));
    child.on('close', (code) => resolve({ code, out, err }));
    child.stdin.on('error', () => {}); // a binary that exits early closes stdin; 'close' reports why
    child.stdin.end(stdin);
  });

/** Parses stream-json output: one JSON event per line, the last `result` event carries the answer. */
const lastResult = (out: string): Record<string, unknown> | undefined =>
  out
    .split('\n')
    .flatMap((line) => {
      try {
        const event: unknown = JSON.parse(line);
        return event && typeof event === 'object' && (event as { type?: unknown }).type === 'result' ? [event as Record<string, unknown>] : [];
      } catch {
        return [];
      }
    })
    .at(-1);

const exited = (code: number | null, err: string) => `Claude Code exited with code ${code}: ${err.trim().split('\n').at(-1) ?? ''}`.trim();

const count = (v: unknown) => (typeof v === 'number' ? v : 0);

/**
 * The default engine: the operator's own Claude Code, headless (SPEC §2). Built-in
 * tools are off and only Applio's MCP server is loaded, so a job posting in the
 * prompt can't make Claude touch files or the shell. The prompt goes in on stdin
 * so it can never be read as a flag.
 */
export function createClaudeCodeEngine(options: Options): AiEngine {
  return {
    async complete({ system, prompt, jobIds, tools = true, webRead }) {
      const args = [
        '-p', '--output-format', 'stream-json', '--verbose', '--strict-mcp-config',
        // A tool-free call (scoring) loads no MCP server at all: one turn, and no tool definitions to pay for.
        '--mcp-config', tools ? options.mcpConfig(jobIds) : JSON.stringify({ mcpServers: {} }),
        // Built-in tools stay off, except the web read for the one call that names a page for it.
        '--tools', webRead ? 'WebFetch' : '',
        // Print mode denies any tool needing a permission prompt, so pre-allow Applio's server (`applio`) and nothing else.
        ...(tools ? ['--allowedTools', 'mcp__applio'] : webRead ? ['--allowedTools', `WebFetch(domain:${new URL(webRead).hostname})`] : []),
        // The operator's own hooks (from their Claude Code settings and plugins) must not run inside
        // Applio's calls: they add tokens, change behavior, and can run commands.
        '--settings', JSON.stringify({ disableAllHooks: true }),
        '--no-session-persistence',
        ...(system ? ['--system-prompt', system] : []),
      ];
      const { code, out, err } = await run(options, args, prompt);
      const result = lastResult(out);
      if (!result) throw new EngineError(code === 0 ? 'Claude Code returned no result.' : exited(code, err));
      if (result.is_error === true || result.subtype !== 'success') {
        if (/not logged in/i.test(String(result.result))) throw new EngineError(NOT_SIGNED_IN);
        const reason = typeof result.result === 'string' && result.result.trim() ? `: ${result.result.trim().slice(0, 300)}` : ` (${String(result.subtype)}).`;
        throw new EngineError(`Claude Code couldn't finish${reason}`);
      }
      const usage = (result.usage ?? {}) as Record<string, unknown>;
      return {
        text: String(result.result ?? ''),
        inputTokens: count(usage.input_tokens) + count(usage.cache_creation_input_tokens),
        outputTokens: count(usage.output_tokens),
        cacheReadTokens: count(usage.cache_read_input_tokens),
      };
    },

    async check(): Promise<{ ready: boolean; message: string; command?: string }> {
      const signIn = `CLAUDE_CONFIG_DIR="${options.configDir}" claude auth login`;
      try {
        const { code, out, err } = await run(options, ['auth', 'status', '--json'], '');
        // Logged out exits 1 with the status still on stdout.
        if (!out.trim()) throw new EngineError(exited(code, err));
        const status: unknown = JSON.parse(out);
        const loggedIn = !!status && typeof status === 'object' && (status as { loggedIn?: unknown }).loggedIn === true;
        return loggedIn ? { ready: true, message: 'Claude Code is signed in.' } : { ready: false, message: NOT_SIGNED_IN, command: signIn };
      } catch (err) {
        return { ready: false, message: err instanceof EngineError ? err.message : NOT_SIGNED_IN };
      }
    },
  };
}
