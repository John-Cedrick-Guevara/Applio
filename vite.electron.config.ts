import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

/**
 * Builds the Electron main process (`--mode main`), preload (`--mode preload`) or
 * the MCP server Claude Code starts (`--mode mcp`), or the end-to-end check (`--mode e2e`,
 * `npm run e2e`) into one CommonJS file each.
 * They're separate builds so each is self-contained: the sandboxed preload can't
 * `require` shared chunks, and the MCP server runs as plain Node.
 */
export default defineConfig(({ mode }) => {
  const entry = mode === 'preload' ? 'preload' : mode === 'mcp' ? 'mcp' : mode === 'e2e' ? 'e2e' : 'main';
  return {
    // Main runs in Node: resolve packages' Node builds, not their "browser" builds (Vite's default),
    // which differ in API — e.g. mammoth's browser build drops Buffer input. Preload keeps the defaults.
    resolve:
      entry !== 'preload'
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
