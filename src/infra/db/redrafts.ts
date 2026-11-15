import type { RedraftRequest } from '../../shared/types';
import type { SettingsRepo } from './settings';

export interface RedraftsRepo {
  /** The operator's pending redraft of a job, until its new part is saved or it fails. */
  get(jobId: string): RedraftRequest | undefined;
  save(jobId: string, request: RedraftRequest): void;
  clear(jobId: string): void;
}

const PREFIX = 'redraft:';

/**
 * Pending operator redrafts, in the settings table under `redraft:<jobId>`, so the MCP
 * server process (a separate process for Claude Code) sees what main set.
 */
export function createRedraftsRepo(kv: SettingsRepo): RedraftsRepo {
  return {
    get: (jobId) => kv.get(PREFIX + jobId) as RedraftRequest | undefined,
    save: (jobId, request) => kv.set(PREFIX + jobId, request),
    clear: (jobId) => kv.delete(PREFIX + jobId),
  };
}
