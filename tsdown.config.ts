/**
 * Standalone build for the dsh-ui-chime plugin (installed through
 * dsh-launcher, never merged into the deepseek-harness checkout).
 *
 * Two artifacts:
 *  - lib/index.js   — the node half (host Loader row): an empty apply so the
 *                     row mounts; the browser half ships via `dsh.client`.
 *  - lib/client.js  — the browser bundle in the loader table format
 *                     (`window.__ModuleLoader__.load({ id, factory })`,
 *                     CJS). The only runtime value dependency is react (a
 *                     platform module); every @deepseek-ai import is
 *                     type-only and erased by tsc, so the bundle needs no
 *                     other external.
 */
import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    name: '@uachar/dsh-ui-chime',
    entry: { index: 'lib/types/index.js' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    deps: {
      neverBundle: [/^@deepseek-ai\//],
    },
    outputOptions: {
      entryFileNames: 'index.js',
    },
  },
  {
    name: '@uachar/dsh-ui-chime/client',
    entry: { client: 'lib/types/client/index.js' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      neverBundle: [/^@deepseek-ai\//, 'react', 'react/jsx-runtime'],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.MODE': JSON.stringify('production'),
      'import.meta.env': JSON.stringify({ MODE: 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@uachar/dsh-ui-chime", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
