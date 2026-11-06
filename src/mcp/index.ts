import { openDatabase } from '../infra/db';
import { createToolPorts } from './db-ports';
import { serveMcp } from './server';
import { createTools } from './tools';

/**
 * The MCP server process Claude Code starts (see `src/main/mcp-config.ts`).
 * stdout carries the protocol only; logs go to stderr.
 */
function main() {
  const dbPath = process.env.APPLIO_DB;
  if (!dbPath) {
    console.error('[mcp] APPLIO_DB is not set');
    process.exit(1);
  }
  const jobIds = (process.env.APPLIO_JOB_IDS ?? '').split(',').filter(Boolean);
  const db = openDatabase(dbPath);
  void serveMcp(createTools(createToolPorts(db, jobIds, () => new Date())), process.stdin, process.stdout).then(() => db.close());
}

main();
