import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Renderer lives in src/renderer (Electron convention). `base: './'` keeps asset
// paths relative so the build also loads from file:// inside Electron.
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
