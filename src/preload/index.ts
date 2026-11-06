import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { API_METHODS, type ApplioApi, type ApplioEvents } from '../shared/api';
import { channelFor, STATUS_CHANNEL, unwrapIpcError } from '../shared/ipc';
import type { AppStatus } from '../shared/types';

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

/** Status pushed by main. Only the payload crosses over, never the IPC event object. */
const events: ApplioEvents = {
  onStatus: (listener) => {
    const handler = (_event: IpcRendererEvent, status: AppStatus) => listener(status);
    ipcRenderer.on(STATUS_CHANNEL, handler);
    return () => ipcRenderer.off(STATUS_CHANNEL, handler);
  },
};

contextBridge.exposeInMainWorld('applioEvents', events);
