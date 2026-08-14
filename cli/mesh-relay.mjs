#!/usr/bin/env node
// 0state mesh relay — bridges offline governance to the chain.
//
// Watches an inbox directory for envelopes carrying offline-signed 0state
// transactions (as produced by `0state vote <id> <choice> --offline`) and
// submits each to Solana. This is the "companion relay" of the bitchat
// integration: native/bridge code drops received mesh messages into the inbox;
// this daemon settles them on-chain the moment it has connectivity.
//
// Envelope format (one per line, or a whole file):
//   0state:tx:1:<base64-signed-transaction>
// A bare base64 transaction (no prefix) is also accepted.
//
// Usage:
//   node mesh-relay.mjs [--inbox DIR] [--rpc URL]
//     --inbox DIR   directory to watch (default ./inbox)
//     --rpc URL     cluster (default devnet)      env: FRANK_RPC
//
// Processed envelopes move to <inbox>/done, failures to <inbox>/failed.

import fs from 'fs';
import path from 'path';
import { Connection } from '@solana/web3.js';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const rpc = arg('rpc', process.env.FRANK_RPC || 'https://api.devnet.solana.com');
const inbox = path.resolve(arg('inbox', './inbox'));
const done = path.join(inbox, 'done');
const failed = path.join(inbox, 'failed');
for (const d of [inbox, done, failed]) fs.mkdirSync(d, { recursive: true });

const conn = new Connection(rpc, 'confirmed');
const ENVELOPE = /(?:^|\s)0state:tx:1:([A-Za-z0-9+/=]+)/g;

// Pull every envelope payload out of a file's text (prefixed or bare base64).
function extract(text) {
  const out = [];
  let m;
  while ((m = ENVELOPE.exec(text)) !== null) out.push(m[1]);
  if (out.length === 0) {
    const bare = text.trim();
    if (/^[A-Za-z0-9+/=]+$/.test(bare) && bare.length > 120) out.push(bare);
  }
  return out;
}

async function relayOne(b64) {
  const raw = Buffer.from(b64, 'base64');
  const sig = await conn.sendRawTransaction(raw, { skipPreflight: false });
  await conn.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function handle(file) {
  const full = path.join(inbox, file);
  let text;
  try { text = fs.readFileSync(full, 'utf8'); } catch { return; }
  const envelopes = extract(text);
  if (envelopes.length === 0) { fs.renameSync(full, path.join(failed, file)); console.log('skip (no envelope):', file); return; }
  let ok = 0;
  for (const b64 of envelopes) {
    try { const sig = await relayOne(b64); ok++; console.log('relayed', file, '→', sig); }
    catch (e) { console.log('failed', file, '—', String(e.message || e).split('\n')[0].slice(0, 100)); }
  }
  fs.renameSync(full, path.join(ok ? done : failed, file));
}

async function sweep() {
  for (const f of fs.readdirSync(inbox)) {
    if (['done', 'failed'].includes(f)) continue;
    if (fs.statSync(path.join(inbox, f)).isFile()) await handle(f);
  }
}

console.log('0state mesh relay');
console.log('  inbox', inbox);
console.log('  rpc  ', rpc);
console.log('  watching for 0state:tx envelopes…\n');
await sweep();
fs.watch(inbox, async (_e, f) => { if (f && fs.existsSync(path.join(inbox, f)) && fs.statSync(path.join(inbox, f)).isFile()) { await new Promise(r => setTimeout(r, 150)); handle(f).catch(() => {}); } });
setInterval(() => sweep().catch(() => {}), 30000); // safety re-sweep
