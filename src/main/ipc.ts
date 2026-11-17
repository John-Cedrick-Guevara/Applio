import { ipcMain } from 'electron';
import { API_METHODS, type ApplioApi } from '../shared/api';
import { channelFor } from '../shared/ipc';
import { InvalidRequestError, parseApiArgs } from '../shared/schemas';
import { isAppUrl } from './security';

/**
 * Registers one IPC handler per allow-listed API method. Each call checks the
 * sender is the app's own renderer and its arguments match the method's schema,
 * logs full failure detail on the main side (never argument values, which may
 * hold secrets) to the console and, through `logFailure`, a file the operator can
 * read after the fact, and rethrows only the operator-readable message.
 */
export function registerApiHandlers(
  api: ApplioApi,
  devServerUrl: string | undefined,
  logFailure: (method: string, err: unknown) => void = () => {},
): void {
  for (const method of API_METHODS) {
    ipcMain.handle(channelFor(method), async (event, ...args: unknown[]) => {
      const senderUrl = event.senderFrame?.url ?? '';
      if (!isAppUrl(senderUrl, devServerUrl)) {
        console.error(`[ipc] rejected ${method} from untrusted sender`, senderUrl);
        throw new Error('Request rejected');
      }
      try {
        const fn = api[method] as (...a: unknown[]) => Promise<unknown>;
        return await fn(...parseApiArgs(method, args));
      } catch (err) {
        if (err instanceof InvalidRequestError) console.error(`[ipc] rejected ${method}: invalid arguments`, err.issues);
        else console.error(`[ipc] ${method} failed`, { args: args.length }, err);
        // A broken logger must not hide the real error from the operator.
        try { logFailure(method, err); } catch (logErr) { console.error('[ipc] could not log failure', logErr); }
        throw new Error(err instanceof Error ? err.message : 'Something went wrong', { cause: err });
      }
    });
  }
}
