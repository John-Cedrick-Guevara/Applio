import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

/**
 * Builds the Electron main process (`--mode main`) or preload (`--mode preload`)
 * into one CommonJS file each. They're separate builds so the sandboxed preload
 * is self-contained — it can't `require` shared chunks.
 */
export default defineConfig(({ mode }) => {
  const entry = mode === 'preload' ? 'preload' : 'main';
  return {
    build: {
      outDir: 'dist/electron',
      emptyOutDir: false,
      target: 'node22',
      sourcemap: true,
      minify: false,
      lib: { entry: `src/${entry}/index.ts`, formats: ['cjs'], fileName: () => `${entry}.cjs` },
      rollupOptions: {
        external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      },
    },
  };
});
