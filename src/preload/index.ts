import { contextBridge, ipcRenderer } from 'electron';
import { API_METHODS, type ApplioApi } from '../shared/api';
import { channelFor, unwrapIpcError } from '../shared/ipc';

/**
 * Exposes `window.applio`: one async function per allow-listed API method,
 * each forwarding to its IPC channel. Nothing else from Node or Electron
 * reaches the renderer.
 */
const api = Object.fromEntries(
  API_METHODS.map((method) => [
    method,
    async (...args: unknown[]) => {
      try {
        return await ipcRenderer.invoke(channelFor(method), ...args);
      } catch (err) {
        throw new Error(unwrapIpcError(err instanceof Error ? err.message : String(err)), { cause: err });
      }
    },
  ]),
) as unknown as ApplioApi;

contextBridge.exposeInMainWorld('applio', api);
