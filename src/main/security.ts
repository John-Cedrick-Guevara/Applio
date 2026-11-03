/**
 * True when `url` is the app's own renderer: the packaged file:// page, or the
 * Vite dev server during development. IPC and navigation are limited to these.
 */
export function isAppUrl(url: string, devServerUrl: string | undefined): boolean {
  if (url.startsWith('file://')) return true;
  if (!devServerUrl) return false;
  try {
    return new URL(url).origin === new URL(devServerUrl).origin;
  } catch {
    return false; // unparsable URL is never trusted
  }
}

/** Only http(s) links may be handed to the OS — never file:, javascript: or custom schemes. */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Handler for `setWindowOpenHandler`: never opens a second app window;
 * safe web links go to the system browser instead.
 */
export function denyAndOpenExternally(openExternal: (url: string) => void) {
  return ({ url }: { url: string }): { action: 'deny' } => {
    if (isSafeExternalUrl(url)) openExternal(url);
    return { action: 'deny' };
  };
}

/**
 * Handler for `will-navigate`: in-app navigation proceeds; anything else is
 * blocked, and if it's a web link it opens in the system browser instead.
 */
export function guardNavigation(devServerUrl: string | undefined, openExternal: (url: string) => void) {
  return (event: { preventDefault(): void }, url: string): void => {
    if (isAppUrl(url, devServerUrl)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) openExternal(url);
  };
}
