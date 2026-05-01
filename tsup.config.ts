import { defineConfig } from 'tsup';

/**
 * Dual ESM + CJS build. Producing both formats from a single source is
 * required so callers using `require('@qubiton/sdk')` from CJS code don't
 * fail on the ESM-only entry point. `.d.ts` is generated once and shared
 * across both bundles via the `exports` map in package.json.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outDir: 'dist',
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // Force `.cjs` extension for the CommonJS bundle so the `exports` map can
  // distinguish the two formats. ESM uses the default `.js` extension since
  // package.json declares `"type": "module"`.
  outExtension({ format }) {
    if (format === 'cjs') return { js: '.cjs' };
    return { js: '.js' };
  },
  splitting: false,
  treeshake: true,
});
