import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * One file out. Everything inlines so dist/index.html opens by double-click.
 * QUIRE_SEED=/path/to/workspace.quire.json embeds that workspace instead of the sample, for a
 * copy that opens straight onto one application's documents.
 */
const seed = process.env.QUIRE_SEED ? resolve(process.env.QUIRE_SEED) : resolve(import.meta.dirname, 'src/seed.json');

export default defineConfig({
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  resolve: { alias: [{ find: /^\.\/seed\.json$/, replacement: seed }] },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    reportCompressedSize: false,
  },
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
  },
});
