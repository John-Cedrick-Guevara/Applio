import { describe, expect, it } from 'vitest';
import { mcpConfigFor, outsideAsar } from './mcp-config';

describe('mcpConfigFor', () => {
  const config = JSON.parse(mcpConfigFor({ execPath: '/Applications/Applio.app/Contents/MacOS/Applio', script: '/app/dist/electron/mcp.cjs', dbPath: '/Users/me/Applio/applio.db' }, ['j1', 'j2']));

  it("starts Applio's own server over stdio, with no URL or port another process could reach", () => {
    expect(Object.keys(config.mcpServers)).toEqual(['applio']);
    expect(config.mcpServers.applio).toEqual({
      type: 'stdio',
      command: '/Applications/Applio.app/Contents/MacOS/Applio',
      args: ['/app/dist/electron/mcp.cjs'],
      env: { ELECTRON_RUN_AS_NODE: '1', APPLIO_DB: '/Users/me/Applio/applio.db', APPLIO_JOB_IDS: 'j1,j2' },
    });
  });
});

describe('outsideAsar', () => {
  it("points a packaged script at its unpacked copy, which a separate process can run", () => {
    expect(outsideAsar('/Applications/Applio.app/Contents/Resources/app.asar/dist/electron/mcp.cjs')).toBe('/Applications/Applio.app/Contents/Resources/app.asar.unpacked/dist/electron/mcp.cjs');
  });

  it('leaves a path outside any archive as it is, as when running from the repo', () => {
    expect(outsideAsar('/Users/sam/Applio/dist/electron/mcp.cjs')).toBe('/Users/sam/Applio/dist/electron/mcp.cjs');
  });
});
