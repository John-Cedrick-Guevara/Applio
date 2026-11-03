import { ipcMain } from 'electron';
import { API_METHODS, type ApplioApi } from '../shared/api';
import { channelFor } from '../shared/ipc';
import { isAppUrl } from './security';

/**
 * Registers one IPC handler per allow-listed API method. Each call checks the
 * sender is the app's own renderer, logs full failure detail on the main side,
 * and rethrows only the operator-readable message.
 * ponytail: argument shapes aren't validated yet — add zod schemas per method as real services replace the in-memory store.
 */
export function registerApiHandlers(api: ApplioApi, devServerUrl: string | undefined): void {
  for (const method of API_METHODS) {
    ipcMain.handle(channelFor(method), async (event, ...args: unknown[]) => {
      const senderUrl = event.senderFrame?.url ?? '';
      if (!isAppUrl(senderUrl, devServerUrl)) {
        console.error(`[ipc] rejected ${method} from untrusted sender`, senderUrl);
        throw new Error('Request rejected');
      }
      try {
        const fn = api[method] as (...a: unknown[]) => Promise<unknown>;
        return await fn(...args);
      } catch (err) {
        console.error(`[ipc] ${method} failed`, { args: args.length }, err);
        throw new Error(err instanceof Error ? err.message : 'Something went wrong', { cause: err });
      }
    });
  }
}
