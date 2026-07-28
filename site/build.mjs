// Bundles src/app.mjs (+ @solana/web3.js) into app.js for the static site.
// The bundle is committed; CI re-runs this and fails on drift.
import { build } from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';
await build({
  entryPoints: ['src/app.mjs'],
  bundle: true,
  format: 'iife',
  outfile: 'app.js',
  platform: 'browser',
  target: ['es2020'],
  plugins: [polyfillNode({ polyfills: { buffer: true } })],
  define: { 'global': 'globalThis' },
  legalComments: 'none',
});
console.log('built app.js');
