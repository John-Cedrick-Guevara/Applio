// Dev runner: Vite dev server for the renderer (with HMR), a one-off build of
// main + preload, then Electron pointed at the dev server. Restart to pick up
// main/preload changes.
import { spawn } from 'node:child_process';
import electron from 'electron';
import { build, createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite dev server did not report a URL');

for (const mode of ['main', 'preload', 'mcp']) {
  await build({ configFile: 'vite.electron.config.ts', mode, logLevel: 'warn' });
}

const app = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });
app.on('close', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
