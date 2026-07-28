// 0state.website — the citizens' terminal.
//
// Reads every proposal from the chain and, when a miner connects Phantom, lets
// them vote or put a question to the commune. Signs with the user's own wallet
// via Phantom's injected provider directly — no wallet-adapter (that mismatch
// is what broke an earlier dapp), no custody, no server. @solana/web3.js is
// used only to derive PDAs and serialize the transaction Phantom signs; every
// instruction is built by hand against the on-chain program.

import {
  Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram,
} from '@solana/web3.js';
import sha3 from 'js-sha3';
const { keccak256 } = sha3;

const RPC = 'https://api.devnet.solana.com';
const ZEROSTATE = new PublicKey('CcEbfypSNbA1YKPsW7PVLRQzzEnKKMcPXBL7CxDW9Joz');
const FRANKCOIN = new PublicKey('61yBp4FQSXq6qxS1Scny8LRBNDLDoNQBKupofVSyyHL8');
const SYS = SystemProgram.programId;
const conn = new Connection(RPC, 'confirmed');

// instruction discriminators, straight from the program IDL
const D_VOTE = [227, 110, 155, 23, 136, 126, 172, 25];
const D_PROPOSE = [93, 253, 82, 168, 118, 33, 102, 90];
const PROPOSAL_DISC = [26, 94, 189, 187, 116, 136, 53, 33];

const enc = new TextEncoder();
const seed = (s) => enc.encode(s);
const u64le = (n) => { const b = new Uint8Array(8); let v = BigInt(n); for (let i = 0; i < 8; i++) { b[i] = Number(v & 0xffn); v >>= 8n; } return b; };
const pda = (seeds, prog = ZEROSTATE) => PublicKey.findProgramAddressSync(seeds, prog)[0];
const daoPda = () => pda([seed('dao')]);
const citizenPda = (w) => pda([seed('citizen'), w.toBytes()]);
const proposalPda = (id) => pda([seed('proposal'), u64le(id)]);
const ballotPda = (pr, cz) => pda([seed('ballot'), pr.toBytes(), cz.toBytes()]);
const proofPda = (w) => pda([seed('proof'), w.toBytes()], FRANKCOIN);

let wallet = null;   // connected Phantom pubkey (PublicKey)
let daoState = null; // { citizenCount, proposalCount }

// ---------------------------------------------------------------- decoding
function decodeProposal(d) {
  let o = 8 + 1;
  const id = Number(new DataView(d.buffer, d.byteOffset + o, 8).getBigUint64(0, true)); o += 8;
  o += 32;
  const tlen = new DataView(d.buffer, d.byteOffset + o, 4).getUint32(0, true); o += 4;
  const title = new TextDecoder().decode(d.slice(o, o + tlen)); o += tlen;
  o += 32; // body_hash
  o += 8;  // created_ts
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
async function sendIx(ix) {
  const provider = window.solana;
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet;
  tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash;
  const { signature } = await provider.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, 'confirmed');
  return signature;
}

function voteIx(id, choice) {
  const proposal = proposalPda(id);
  const citizen = citizenPda(wallet);
  return new TransactionInstruction({
    programId: ZEROSTATE,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: citizen, isSigner: false, isWritable: true },
      { pubkey: proposal, isSigner: false, isWritable: true },
      { pubkey: ballotPda(proposal, citizen), isSigner: false, isWritable: true },
      { pubkey: SYS, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([...D_VOTE, choice]),
  });
}

async function proposeIx(title, bodyHash /* Uint8Array(32) */) {
  const titleBytes = enc.encode(title);
  const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, titleBytes.length, true);
  const data = Buffer.from([...D_PROPOSE, ...len, ...titleBytes, ...bodyHash]);
  return new TransactionInstruction({
    programId: ZEROSTATE,
    keys: [
      { pubkey: wallet, isSigner: true, isWritable: true },
      { pubkey: daoPda(), isSigner: false, isWritable: true },
      { pubkey: citizenPda(wallet), isSigner: false, isWritable: false },
      { pubkey: proposalPda(daoState.proposalCount), isSigner: false, isWritable: true },
      { pubkey: SYS, isSigner: false, isWritable: false },
    ],
    data,
  });
}

async function isCitizen(w) {
  return !!(await conn.getAccountInfo(citizenPda(w)));
}

// ---------------------------------------------------------------- UI
const $ = (id) => document.getElementById(id);
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function bar(y, n, a) {
  const t = y + n + a; if (!t) return '<i class="y" style="width:0"></i>';
  const w = (v) => (v / t * 100).toFixed(1) + '%';
  return `<i class="y" style="width:${w(y)}"></i><i class="n" style="width:${w(n)}"></i><i class="a" style="width:${w(a)}"></i>`;
}

let citizenNow = false;
function renderProposals(list) {
  const box = $('fProposalList'); if (!box) return;
  if (!list.length) { box.innerHTML = '<p class="aside">no proposals have been put to the commune yet.</p>'; return; }
  const now = Math.floor(Date.now() / 1000);
  box.innerHTML = list.map((p) => {
    const open = now < p.closes, total = p.yes + p.no + p.abstain;
    const turnout = p.electorate ? ` &middot; turnout ${total}/${p.electorate}` : '';
    const close = new Date(p.closes * 1000).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
    const canVote = wallet && citizenNow && open;
    const btns = canVote
      ? `<div class="prop-vote"><button data-vote="1" data-id="${p.id}">vote yes</button>`
        + `<button data-vote="0" data-id="${p.id}">vote no</button>`
        + `<button data-vote="2" data-id="${p.id}">abstain</button></div>`
      : '';
    return `<div class="prop"><div class="prop-head"><span class="prop-title">${esc(p.title)}</span>`
      + `<span class="prop-state ${open ? 'open' : 'closed'}">${open ? 'open' : 'closed'}</span></div>`
      + `<div class="tally">${bar(p.yes, p.no, p.abstain)}</div>`
      + `<div class="prop-nums"><span>yes <b>${p.yes}</b></span><span>no <b>${p.no}</b></span>`
      + `<span>abstain <b>${p.abstain}</b></span><span>&middot; ${total} voted${turnout}</span></div>`
      + `<div class="prop-close">${open ? 'closes ' : 'closed '}${close} &middot; #${p.id}</div>${btns}</div>`;
  }).join('');

  box.querySelectorAll('button[data-vote]').forEach((b) => {
    b.addEventListener('click', async () => {
      const id = +b.dataset.id, choice = +b.dataset.vote;
      const row = b.closest('.prop-vote');
      row.querySelectorAll('button').forEach((x) => x.disabled = true);
      b.textContent = 'signing…';
      try { const sig = await sendIx(voteIx(id, choice)); flash(`voted — ${sig.slice(0, 8)}…`); await refresh(); }
      catch (e) { flash(errMsg(e), true); row.querySelectorAll('button').forEach((x) => x.disabled = false); b.textContent = ['vote no', 'vote yes', 'abstain'][choice]; }
    });
  });
}

function errMsg(e) {
  const m = String(e?.message || e);
  if (/already in use|0x0\b/.test(m)) return 'you have already voted on this proposal';
  if (/NotAFrankcoinProof|InsufficientLabour/.test(m)) return 'only miners admitted to the commune may act';
  if (/User rejected|rejected the request/i.test(m)) return 'cancelled';
  return m.slice(0, 90);
}

let flashTimer;
function flash(msg, bad) {
  const el = $('fFlash'); if (!el) return;
  el.textContent = msg; el.className = 'flash' + (bad ? ' bad' : '');
  clearTimeout(flashTimer); flashTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}

async function refresh() {
  try {
    const info = await conn.getAccountInfo(daoPda());
    if (info) {
      const d = info.data;
      const rd = (off) => Number(new DataView(d.buffer, d.byteOffset + off, 8).getBigUint64(0, true));
      daoState = { citizenCount: rd(89), proposalCount: rd(97) };
    }
    if (wallet) citizenNow = await isCitizen(wallet);
    renderProposals(await loadProposals());
  } catch (e) { const box = $('fProposalList'); if (box) box.innerHTML = '<p class="aside">the network did not answer.</p>'; }
}

async function connect() {
  const p = window.solana;
  if (!p || !p.isPhantom) { flash('Phantom wallet not found — install it to vote', true); return; }
  try {
    const r = await p.connect();
    wallet = new PublicKey(r.publicKey.toString());
    const btn = $('fConnect');
    btn.textContent = wallet.toBase58().slice(0, 4) + '…' + wallet.toBase58().slice(-4);
    citizenNow = await isCitizen(wallet);
    const mined = !!(await conn.getAccountInfo(proofPda(wallet)));
    $('fWho').textContent = citizenNow ? 'you are a citizen — you may vote and propose'
      : mined ? 'you have mined but are not admitted — ask the authority to admit you'
      : 'you have not mined frankcoin; only miners can become citizens';
    setupPropose();
    await refresh();
  } catch (e) { flash(errMsg(e), true); }
}

function setupPropose() {
  const wrap = $('fProposeWrap'); if (!wrap) return;
  wrap.style.display = citizenNow ? 'block' : 'none';
  const btn = $('fProposeBtn');
  btn.onclick = async () => {
    const title = $('fTitle').value.trim();
    if (!title) return flash('give the proposal a title', true);
    if (new TextEncoder().encode(title).length > 96) return flash('title too long (max 96 bytes)', true);
    const body = $('fBody').value;
    // keccak256 of the body, matching the CLI, so the on-chain body_hash pins
    // the off-chain text identically no matter which client submitted it.
    const hash = new Uint8Array(keccak256.arrayBuffer(new TextEncoder().encode(body)));
    btn.disabled = true; btn.textContent = 'signing…';
    try { const sig = await sendIx(await proposeIx(title, hash)); flash(`proposed — ${sig.slice(0, 8)}…`); $('fTitle').value = ''; $('fBody').value = ''; await refresh(); }
    catch (e) { flash(errMsg(e), true); }
    finally { btn.disabled = false; btn.textContent = 'submit proposal'; }
  };
}

function boot() {
  const btn = $('fConnect');
  if (btn) btn.addEventListener('click', connect);
  refresh();
  setInterval(refresh, 30000);
  // reconnect silently if Phantom already trusts this site
  if (window.solana?.isPhantom) window.solana.connect({ onlyIfTrusted: true }).then((r) => { if (r?.publicKey) connect(); }).catch(() => {});
}
if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
