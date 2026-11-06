import { spawn } from 'node:child_process';
import type { AiEngine } from '../../core/ai/engine';
import { AppError } from '../../shared/errors';

const NOT_INSTALLED = "Claude Code isn't installed. Install it from claude.com/claude-code, or switch to an Anthropic API key below.";
const NOT_SIGNED_IN = "Claude Code isn't signed in. Run `claude auth login` in a terminal, or switch to an Anthropic API key below.";
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
  env: NodeJS.ProcessEnv;
  /** Applio's MCP config as JSON for these jobs; nothing else is loaded (`--strict-mcp-config`). */
  mcpConfig: (jobIds: readonly string[]) => string;
}

/** Runs the binary, feeding `stdin`, and resolves its stdout once it exits 0. */
const run = ({ command, cwd, env }: Options, args: string[], stdin: string) =>
  new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], timeout: TIMEOUT_MS });
    let out = '';
    let err = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString()));
    child.stderr.on('data', (c: Buffer) => (err += c.toString()));
    child.on('error', (e: NodeJS.ErrnoException) => reject(new EngineError(e.code === 'ENOENT' ? NOT_INSTALLED : `Claude Code couldn't start: ${e.message}`, { cause: e })));
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new EngineError(`Claude Code exited with code ${code}: ${err.trim().split('\n').at(-1) ?? ''}`.trim()));
    });
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

const count = (v: unknown) => (typeof v === 'number' ? v : 0);

/**
 * The default engine: the operator's own Claude Code, headless (SPEC §2). Built-in
 * tools are off and only Applio's MCP server is loaded, so a job posting in the
 * prompt can't make Claude touch files or the shell. The prompt goes in on stdin
 * so it can never be read as a flag.
 */
export function createClaudeCodeEngine(options: Options): AiEngine {
  return {
    async complete({ system, prompt, jobIds }) {
      const args = [
        '-p', '--output-format', 'stream-json', '--verbose', '--strict-mcp-config',
        '--mcp-config', options.mcpConfig(jobIds),
        '--tools', '',
        // Print mode denies any tool needing a permission prompt, so pre-allow Applio's server (`applio`) and nothing else.
        '--allowedTools', 'mcp__applio',
        '--no-session-persistence',
        ...(system ? ['--system-prompt', system] : []),
      ];
      const result = lastResult(await run(options, args, prompt));
      if (!result) throw new EngineError('Claude Code returned no result.');
      if (result.is_error === true || result.subtype !== 'success') throw new EngineError(`Claude Code couldn't finish (${String(result.subtype)}).`);
      const usage = (result.usage ?? {}) as Record<string, unknown>;
      return {
        text: String(result.result ?? ''),
        inputTokens: count(usage.input_tokens) + count(usage.cache_creation_input_tokens) + count(usage.cache_read_input_tokens),
        outputTokens: count(usage.output_tokens),
      };
    },

    async check() {
      try {
        const status: unknown = JSON.parse(await run(options, ['auth', 'status', '--json'], ''));
        const loggedIn = !!status && typeof status === 'object' && (status as { loggedIn?: unknown }).loggedIn === true;
        return loggedIn ? { ready: true, message: 'Claude Code is signed in.' } : { ready: false, message: NOT_SIGNED_IN };
      } catch (err) {
        return { ready: false, message: err instanceof EngineError ? err.message : NOT_SIGNED_IN };
      }
    },
  };
}
