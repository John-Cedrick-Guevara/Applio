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
    // Main runs in Node: resolve packages' Node builds, not their "browser" builds (Vite's default),
    // which differ in API — e.g. mammoth's browser build drops Buffer input. Preload keeps the defaults.
    resolve:
      entry === 'main'
        ? { mainFields: ['module', 'jsnext:main', 'jsnext', 'main'], conditions: ['node', 'module', 'import', 'default'] }
        : undefined,
    build: {
      outDir: 'dist/electron',
      emptyOutDir: false,
      target: 'node22',
      sourcemap: true,
      minify: false,
      lib: { entry: `src/${entry}/index.ts`, formats: ['cjs'], fileName: () => `${entry}.cjs` },
      rollupOptions: {
        external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
        // CommonJS has no import.meta. The bundler already swaps it for {} and warns; saying so here
        // keeps the build quiet. The only use in main, unpdf's `import.meta.resolve` for pdf.js font
        // data, sits in a try/catch and falls back to defaults that text extraction doesn't need.
        transform: { define: { 'import.meta': '{}' } },
      },
    },
  };
});
