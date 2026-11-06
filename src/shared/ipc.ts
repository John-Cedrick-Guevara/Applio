import type { ApplioApi } from './api';

/** IPC channel for an API method. Namespaced so it can't collide with Electron's own channels. */
export function channelFor(method: keyof ApplioApi): string {
  return `applio:${method}`;
}

/** Main → renderer: the new `AppStatus` whenever it changes. Not an API method, so the renderer can't invoke it. */
export const STATUS_CHANNEL = 'applio:status-changed';

const REMOTE_PREFIX = /^Error invoking remote method '[^']*': (?:\w*Error: )?/;

/**
 * Electron prefixes errors thrown in main handlers with "Error invoking remote
 * method …". Strips that so the renderer shows the operator only the message.
 */
export function unwrapIpcError(message: string): string {
  return message.replace(REMOTE_PREFIX, '');
}
