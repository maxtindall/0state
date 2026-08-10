// 0state.website — the members' terminal (v2, miners-only).
//
// 0state is a political organization governed by the miners of frankcoin.
// franks are a currency; the vote is earned only by mining and cannot be traded.
// Connect Phantom (its injected provider directly — no wallet-adapter); if you
// have mined, join; if you are a member, propose and vote. Weight is sub-linear
// in franks mined and decays with inactivity. @solana/web3.js is used only for
// PDAs and transaction serialization; every instruction is built by hand.

import {
  Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram,
} from '@solana/web3.js';
import sha3 from 'js-sha3';
const { keccak256 } = sha3;

const RPC = 'https://api.devnet.solana.com';
const ZEROSTATE = new PublicKey('BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9');
const FRANKCOIN = new PublicKey('61yBp4FQSXq6qxS1Scny8LRBNDLDoNQBKupofVSyyHL8');
const SYS = SystemProgram.programId;
const conn = new Connection(RPC, 'confirmed');
const ONE_FRANK = 1_000_000_000n;
const HALF_LIFE = 90 * 24 * 60 * 60;

const D_JOIN = [206, 55, 2, 106, 113, 220, 17, 163];
const D_PROPOSE = [93, 253, 82, 168, 118, 33, 102, 90];
const D_VOTE = [227, 110, 155, 23, 136, 126, 172, 25];
const PROPOSAL_DISC = [26, 94, 189, 187, 116, 136, 53, 33];

const enc = new TextEncoder();
const seed = (s) => enc.encode(s);
const u64le = (n) => { const b = new Uint8Array(8); let v = BigInt(n); for (let i = 0; i < 8; i++) { b[i] = Number(v & 0xffn); v >>= 8n; } return b; };
const pda = (seeds, prog = ZEROSTATE) => PublicKey.findProgramAddressSync(seeds, prog)[0];
const daoPda = () => pda([seed('dao')]);
const memberPda = (w) => pda([seed('member'), w.toBytes()]);
const proposalPda = (id) => pda([seed('proposal'), u64le(id)]);
const ballotPda = (pr, m) => pda([seed('ballot'), pr.toBytes(), m.toBytes()]);
const proofPda = (w) => pda([seed('proof'), w.toBytes()], FRANKCOIN);

let wallet = null;       // connected pubkey
let provider = null;     // the injected wallet (Phantom / Solflare / Backpack / …)
let isMember = false;
let hasMined = false;
let myWeight = null;

// Any injected Solana wallet exposes connect() + signAndSendTransaction. Don't
// hard-gate on Phantom — accept whichever standard provider is present.
function getProvider() {
  return (window.phantom && window.phantom.solana) || window.solana
    || window.solflare || (window.backpack && window.backpack.solana) || null;
}

function isqrt(n) { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; }

async function readWeight(w) {
  const info = await conn.getAccountInfo(proofPda(w));
  if (!info) return null;
  const d = info.data;
  const lastClaim = Number(new DataView(d.buffer, d.byteOffset + 8 + 64, 8).getBigInt64(0, true));
  const total = new DataView(d.buffer, d.byteOffset + 8 + 64 + 8, 8).getBigUint64(0, true);
  const whole = total / ONE_FRANK;
  const idle = Math.max(0, Math.floor(Date.now() / 1000) - lastClaim);
  const halvings = BigInt(Math.min(Math.floor(idle / HALF_LIFE), 63));
  return (1n + isqrt(whole >> halvings)).toString();
}

// ---------------------------------------------------------------- decoding
function decodeProposal(d) {
  let o = 8 + 1;
  const id = Number(new DataView(d.buffer, d.byteOffset + o, 8).getBigUint64(0, true)); o += 8; o += 32;
  const tlen = new DataView(d.buffer, d.byteOffset + o, 4).getUint32(0, true); o += 4;
  const title = new TextDecoder().decode(d.slice(o, o + tlen)); o += tlen; o += 32; o += 8;
  const closes = Number(new DataView(d.buffer, d.byteOffset + o, 8).getBigInt64(0, true)); o += 8;
  const rd = (off) => Number(new DataView(d.buffer, d.byteOffset + off, 8).getBigUint64(0, true));
  const yes = rd(o); o += 8; const no = rd(o); o += 8; const abstain = rd(o); o += 8;
  const electorate = o + 8 <= d.length ? rd(o) : null;
  return { id, title, closes, yes, no, abstain, electorate };
}
async function loadProposals() {
  const res = await conn.getProgramAccounts(ZEROSTATE, {
    filters: [{ memcmp: { offset: 0, bytes: btoa(String.fromCharCode(...PROPOSAL_DISC)), encoding: 'base64' } }],
  });
  return res.map((a) => decodeProposal(a.account.data)).sort((a, b) => b.id - a.id);
}

// ---------------------------------------------------------------- transactions
const explorer = (sig) => `https://solscan.io/tx/${sig}?cluster=devnet`;
function simError(v) {
  const logs = (v.logs || []).join(' ');
  const named = /Error Code: (\w+)/.exec(logs);
  const msg = /already in use/i.test(logs) ? 'already in use' : named ? named[1] : JSON.stringify(v.err);
  const e = new Error(msg); e.logs = v.logs; return e;
}
async function sendIx(ix, label) {
  if (!provider || !wallet) throw new Error('connect a wallet first');
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  flash(`${label}: checking on-chain…`);
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) throw simError(sim.value);
  flash(`${label}: approve in your wallet…`);
  const { signature } = await provider.signAndSendTransaction(tx);
  flash(`${label}: confirming ${signature.slice(0, 8)}…`);
  const res = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  if (res.value.err) { const e = new Error('failed on-chain'); e.sig = signature; throw e; }
  return signature;
}

function joinIx() {
  return new TransactionInstruction({
    programId: ZEROSTATE,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: daoPda(), isSigner: false, isWritable: true },
      { pubkey: proofPda(wallet), isSigner: false, isWritable: false },
      { pubkey: memberPda(wallet), isSigner: false, isWritable: true },
      { pubkey: SYS, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from(D_JOIN),
  });
}
function voteIx(id, choice) {
  const proposal = proposalPda(id), member = memberPda(wallet);
  return new TransactionInstruction({
    programId: ZEROSTATE,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: member, isSigner: false, isWritable: true },
      { pubkey: proofPda(wallet), isSigner: false, isWritable: false },
      { pubkey: proposal, isSigner: false, isWritable: true },
      { pubkey: ballotPda(proposal, member), isSigner: false, isWritable: true },
      { pubkey: SYS, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from([...D_VOTE, choice]),
  });
}
function proposeIx(title, bodyHash) {
  const titleBytes = enc.encode(title);
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, titleBytes.length, true);
  return new TransactionInstruction({
    programId: ZEROSTATE,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: daoPda(), isSigner: false, isWritable: true },
      { pubkey: memberPda(wallet), isSigner: false, isWritable: false },
      { pubkey: proposalPda(daoCount), isSigner: false, isWritable: true },
      { pubkey: SYS, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from([...D_PROPOSE, ...len, ...titleBytes, ...bodyHash]),
  });
}

// ---------------------------------------------------------------- UI
const $ = (id) => document.getElementById(id);
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function bar(y, n, a) { const t = y + n + a; if (!t) return '<i class="y" style="width:0"></i>'; const w = (v) => (v / t * 100).toFixed(1) + '%'; return `<i class="y" style="width:${w(y)}"></i><i class="n" style="width:${w(n)}"></i><i class="a" style="width:${w(a)}"></i>`; }

let daoCount = 0;
function renderProposals(list) {
  const box = $('fProposalList'); if (!box) return;
  if (!list.length) { box.innerHTML = '<p class="aside">no proposals yet.</p>'; return; }
  const now = Math.floor(Date.now() / 1000);
  box.innerHTML = list.map((p) => {
    const open = now < p.closes, total = p.yes + p.no + p.abstain;
    const close = new Date(p.closes * 1000).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
    const canVote = wallet && isMember && open;
    const btns = canVote
      ? `<div class="prop-vote"><button data-vote="1" data-id="${p.id}">vote yes</button><button data-vote="0" data-id="${p.id}">vote no</button><button data-vote="2" data-id="${p.id}">abstain</button></div>`
      : '';
    return `<div class="prop"><div class="prop-head"><span class="prop-title">${esc(p.title)}</span>`
      + `<span class="prop-state ${open ? 'open' : 'closed'}">${open ? 'open' : 'closed'}</span></div>`
      + `<div class="tally">${bar(p.yes, p.no, p.abstain)}</div>`
      + `<div class="prop-nums"><span>yes <b>${p.yes}</b></span><span>no <b>${p.no}</b></span>`
      + `<span>abstain <b>${p.abstain}</b></span><span>&middot; weighted · electorate ${p.electorate ?? '?'}</span></div>`
      + `<div class="prop-close">${open ? 'closes ' : 'closed '}${close} &middot; #${p.id}</div>${btns}</div>`;
  }).join('');
  box.querySelectorAll('button[data-vote]').forEach((b) => {
    b.addEventListener('click', async () => {
      const id = +b.dataset.id, choice = +b.dataset.vote;
      const row = b.closest('.prop-vote'); row.querySelectorAll('button').forEach((x) => x.disabled = true); b.textContent = 'signing…';
      try { const sig = await sendIx(voteIx(id, choice), 'vote'); flashOk('voted', sig); await refresh(); }
      catch (e) { flash(errMsg(e), true); row.querySelectorAll('button').forEach((x) => x.disabled = false); b.textContent = ['vote no', 'vote yes', 'abstain'][choice]; }
    });
  });
}

function errMsg(e) {
  const m = String(e?.message || e);
  if (/already in use/i.test(m)) return 'you have already voted on this proposal';
  if (/InsufficientLabour/i.test(m)) return 'you must have mined frankcoin to join';
  if (/ProofOwnerMismatch|NotAFrankcoinProof/i.test(m)) return 'no proof of mining found for this wallet';
  if (/AccountNotInitialized/i.test(m)) return 'you are not a member yet — join first';
  if (/VotingClosed/i.test(m)) return 'voting on this proposal has closed';
  if (/User rejected|rejected the request|declined/i.test(m)) return 'cancelled in wallet';
  if (/Attempt to debit|insufficient|0x1\b/i.test(m)) return 'not enough devnet SOL for the fee';
  return 'error: ' + m.slice(0, 120);
}
let flashTimer;
function flash(msg, bad) { const el = $('fFlash'); if (!el) return; el.textContent = msg; el.className = 'flash' + (bad ? ' bad' : ''); clearTimeout(flashTimer); if (bad) flashTimer = setTimeout(() => { if (el.className.includes('bad')) el.textContent = ''; }, 12000); }
function flashOk(msg, sig) { const el = $('fFlash'); if (!el) return; clearTimeout(flashTimer); el.className = 'flash ok'; el.innerHTML = `${esc(msg)} &mdash; <a href="${explorer(sig)}" target="_blank" rel="noopener">confirmed ${esc(sig.slice(0, 8))}… &#8599;</a>`; }

async function refresh() {
  try {
    const info = await conn.getAccountInfo(daoPda());
    if (info) daoCount = Number(new DataView(info.data.buffer, info.data.byteOffset + 65, 8).getBigUint64(0, true));
    if (wallet) {
      isMember = !!(await conn.getAccountInfo(memberPda(wallet)));
      myWeight = await readWeight(wallet);
      hasMined = myWeight !== null;
      updateWho();
    }
    renderProposals(await loadProposals());
  } catch (e) { const box = $('fProposalList'); if (box) box.innerHTML = '<p class="aside">the network did not answer.</p>'; }
}

function updateWho() {
  const who = $('fWho'), join = $('fJoin'), prop = $('fProposeWrap');
  if (!wallet) { if (who) who.textContent = ''; if (join) join.style.display = 'none'; if (prop) prop.style.display = 'none'; return; }
  if (isMember) {
    who.textContent = `member · voting weight ${myWeight ?? '—'}`;
    if (join) join.style.display = 'none';
    if (prop) prop.style.display = 'block';
  } else if (hasMined) {
    who.textContent = 'you have mined — join to become a member';
    if (join) join.style.display = 'inline-flex';
    if (prop) prop.style.display = 'none';
  } else {
    who.textContent = 'not a member — mine frankcoin, then join';
    if (join) join.style.display = 'none';
    if (prop) prop.style.display = 'none';
  }
}

function shortId(pk) { const s = pk.toBase58(); return s.slice(0, 4) + '…' + s.slice(-4); }

// Detect every injected Solana wallet — not just whichever won window.solana —
// so the user can pick one directly and bypass a rival extension that's
// intercepting or suppressing another's popup.
function detectProviders() {
  const seen = new Set(), list = [];
  const add = (name, p) => { if (p && !seen.has(p)) { seen.add(p); list.push([name, p]); } };
  if (window.phantom && window.phantom.solana) add('Phantom', window.phantom.solana);
  if (window.solflare && window.solflare.isSolflare) add('Solflare', window.solflare);
  if (window.backpack) add('Backpack', window.backpack.solana || window.backpack);
  if (window.solana) add(window.solana.isPhantom ? 'Phantom' : window.solana.isSolflare ? 'Solflare' : 'Wallet', window.solana);
  return list;
}

function connect() {
  const provs = detectProviders();
  if (!provs.length) { flash('No Solana wallet detected — install Phantom, Solflare, or Backpack, then reload', true); return; }
  if (provs.length === 1) { connectWith(provs[0][0], provs[0][1]); return; }
  // Multiple wallets: offer an explicit choice.
  const el = $('fFlash'); if (!el) return;
  el.className = 'flash'; el.textContent = 'more than one wallet found — pick one: ';
  provs.forEach(([name, p]) => {
    const b = document.createElement('button');
    b.textContent = name; b.style.marginLeft = '6px'; b.style.padding = '3px 9px'; b.style.fontSize = '11px';
    b.onclick = () => connectWith(name, p);
    el.appendChild(b);
  });
}

function finishConnect(p, pkStr) {
  provider = p; wallet = new PublicKey(pkStr);
  $('fConnect').textContent = shortId(wallet);
  const el = $('fFlash'); if (el) { el.className = 'flash ok'; el.textContent = `connected as ${shortId(wallet)}`; }
  setupJoin(); setupPropose();
  refresh().catch(() => {});
}

async function connectWith(name, p) {
  provider = p;
  flash(`opening ${name}… approve in the popup (or click the ${name} extension icon)`);
  let r;
  try {
    r = await Promise.race([
      p.connect(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('__timeout')), 25000)),
    ]);
  } catch (e) {
    if (String(e.message) === '__timeout')
      flash(`${name} never opened its popup — another wallet extension is likely intercepting it. Disable the other wallets (or set ${name} as your default), reload, and try again.`, true);
    else flash(errMsg(e), true);
    return;
  }
  const pk = (r && r.publicKey) || p.publicKey;
  if (!pk) { flash(`${name} connected but returned no address — try a different wallet`, true); return; }
  finishConnect(p, pk.toString());
}

function setupJoin() {
  const b = $('fJoin'); if (!b) return;
  b.onclick = async () => {
    b.disabled = true; b.textContent = 'joining…';
    try { const sig = await sendIx(joinIx(), 'join'); flashOk('joined — welcome', sig); await refresh(); }
    catch (e) { flash(errMsg(e), true); }
    finally { b.disabled = false; b.textContent = 'join'; }
  };
}
function setupPropose() {
  const btn = $('fProposeBtn'); if (!btn) return;
  btn.onclick = async () => {
    const title = $('fTitle').value.trim();
    if (!title) return flash('give the proposal a title', true);
    if (new TextEncoder().encode(title).length > 96) return flash('title too long (max 96 bytes)', true);
    const hash = new Uint8Array(keccak256.arrayBuffer(new TextEncoder().encode($('fBody').value)));
    btn.disabled = true; btn.textContent = 'signing…';
    try { const sig = await sendIx(proposeIx(title, hash), 'propose'); flashOk('proposed', sig); $('fTitle').value = ''; $('fBody').value = ''; await refresh(); }
    catch (e) { flash(errMsg(e), true); }
    finally { btn.disabled = false; btn.textContent = 'submit proposal'; }
  };
}

function boot() {
  const b = $('fConnect'); if (b) b.addEventListener('click', connect);
  refresh();
  setInterval(refresh, 30000);
  const provs = detectProviders();
  if (provs.length) { const [, p] = provs[0]; if (p.connect) p.connect({ onlyIfTrusted: true }).then((r) => { if (r && r.publicKey && !wallet) finishConnect(p, r.publicKey.toString()); }).catch(() => {}); }
}
if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
