/** Where the MCP server lives: Electron's own binary, run as Node, on the bundled server script. */
export interface McpServerPaths {
  execPath: string;
  script: string;
  dbPath: string;
}

/**
 * Claude Code's `--mcp-config` for one AI call (SPEC §4): only Applio's server,
 * over stdio, so Claude Code is the only process that can talk to it. The
 * call's job IDs travel in its environment and set the tools' scope.
 */
export function mcpConfigFor({ execPath, script, dbPath }: McpServerPaths, jobIds: readonly string[]): string {
  return JSON.stringify({
    mcpServers: {
      applio: { type: 'stdio', command: execPath, args: [script], env: { ELECTRON_RUN_AS_NODE: '1', APPLIO_DB: dbPath, APPLIO_JOB_IDS: jobIds.join(',') } },
    },
  });
}

/**
 * In the installed app, bundled files sit inside `app.asar`, which only Applio's own
 * process can read. Claude Code starts the MCP server as a separate process, so that
 * script ships unpacked (`asarUnpack`) and is run from `app.asar.unpacked`.
 * Paths outside an archive (running from the repo) are returned as they are.
 */
export const outsideAsar = (path: string): string => path.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2');
