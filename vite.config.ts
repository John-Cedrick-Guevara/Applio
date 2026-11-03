import { defineConfig } from 'vite';

// Renderer lives in src/renderer (Electron convention). `base: './'` keeps asset
// paths relative so the build also loads from file:// inside Electron.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
