#!/usr/bin/env node
// 0state — command-line client (v2, miners-only).
//
// 0state is an autonomous organization governed by the miners of STATE.
// STATE is a currency; the vote is earned only by mining and cannot be traded.
// Membership is permissionless and automatic: mine STATE (`node mine.mjs`) and
// you are a citizen. Voting weight is sub-linear in STATE mined and decays with
// inactivity. Signs with YOUR keypair.
//
// Usage:
//   0state status                       the organization, and your standing
//   0state address       [--key PATH]   the wallet this would act as
//   (membership is automatic — mining STATE is the only qualification)
//   0state proposals                    list proposals and weighted tallies
//   0state propose "<title>" [--body S] put a question (members only)
//   0state propose-spend <to> <STATE> "<title>"   propose a treasury spend
//   0state vote <id> <yes|no|abstain>   cast your weighted vote (members only)
//   0state execute <id>                 enact a passed spending proposal
//   0state nonce-init                   set up offline signing (one-time, online)
//   0state vote <id> <choice> --offline sign a vote offline; prints a relayable tx
//   0state relay <signed-tx>            submit a pre-signed tx (from any peer online)
//
// Options:  --key PATH  keypair (default ~/.config/solana/id.json)
//           --rpc URL   cluster (default devnet)   env: FRANK_RPC

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sha3 from 'js-sha3';
const { keccak256 } = sha3;
import anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, NONCE_ACCOUNT_LENGTH } from '@solana/web3.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ZEROSTATE = new PublicKey('BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9');
const STATE = new PublicKey('2xvfGKpTHy5EA8RFJsKXu73nJVFPRH6YHxDAE5Rh6SVE');
const ONE_STATE = 1_000_000_000;
const HALF_LIFE = 90 * 24 * 60 * 60;

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : def; }
function positionals() { const out = []; const a = process.argv.slice(3); for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { i++; continue; } out.push(a[i]); } return out; }

const rpc = arg('rpc', process.env.FRANK_RPC || 'https://api.devnet.solana.com');
const kpPath = (arg('key', process.env.HOME + '/.config/solana/id.json')).replace(/^~/, process.env.HOME);
const conn = new Connection(rpc, 'confirmed');

function die(msg) { console.error('0state: ' + msg); process.exit(1); }
function loadWallet() { try { return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath)))); } catch (e) { die(`could not read keypair ${kpPath} — ${e.message}`); } }
function loadIdl(n) { return JSON.parse(fs.readFileSync(path.join(HERE, n))); }

const pda = (seeds, prog = ZEROSTATE) => PublicKey.findProgramAddressSync(seeds, prog)[0];
const u64le = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const daoPda = () => pda([Buffer.from('dao')]);
const proposalPda = (id) => pda([Buffer.from('proposal'), u64le(id)]);
const ballotPda = (proposal, voter) => pda([Buffer.from('ballot'), proposal.toBuffer(), voter.toBuffer()]);
const proofPda = (w) => pda([Buffer.from('proof'), w.toBuffer()], STATE);
// STATE treasury (program PDA vault) + its token account
const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROG = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const mintPda = () => pda([Buffer.from('mint')], STATE);
const treasuryPda = () => pda([Buffer.from('treasury')], STATE);
const ata = (owner, mint) => PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROG)[0];
const spentPda = (proposal) => pda([Buffer.from('spent'), proposal.toBuffer()], STATE);

// A per-wallet durable nonce account (derived by seed) so a transaction can be
// signed OFFLINE and stay valid indefinitely — then carried over any channel
// (e.g. a bitchat Bluetooth mesh) and relayed on-chain by any peer with
// connectivity, instead of expiring with a ~60-second blockhash.
const NONCE_SEED = '0state-nonce';
const nonceAccountFor = (pubkey) => PublicKey.createWithSeed(pubkey, NONCE_SEED, SystemProgram.programId);

const CHOICE = { no: 0, yes: 1, abstain: 2 };
const CHOICE_NAME = ['no', 'yes', 'abstain'];

function isqrt(n) { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; }

// Read the STATE Proof account raw (v2's IDL doesn't expose it) and compute
// the voter's weight exactly as the program does, for display.
async function weightFor(wallet, nowSec) {
  const info = await conn.getAccountInfo(proofPda(wallet));
  if (!info) return null;
  const d = info.data;            // 8 disc + miner(32) + challenge(32) + last_claim(i64) + total_mined(u64) + count(u64)
  const lastClaim = Number(d.readBigInt64LE(8 + 64));
  const total = d.readBigUInt64LE(8 + 64 + 8);
  const whole = total / BigInt(ONE_STATE);
  const idle = Math.max(0, nowSec - lastClaim);
  const halvings = BigInt(Math.min(Math.floor(idle / HALF_LIFE), 63));
  return (1n + isqrt(whole >> halvings)).toString();
}

// The membership count = distinct miners = STATE Proof accounts with count>=1.
// (Membership is automatic, so there is no on-chain roster to read.)
async function countMiners() {
  try {
    const res = await conn.getProgramAccounts(STATE, {
      dataSlice: { offset: 88, length: 8 }, // the Proof.count field
      filters: [{ dataSize: 997 }],
    });
    return res.reduce((n, a) => n + (a.account.data.readBigUInt64LE(0) >= 1n ? 1 : 0), 0);
  } catch { return null; }
}

// raw Proposal decode (tolerant), for listing
function decodeProposal(d) {
  let o = 8 + 1;
  const id = Number(d.readBigUInt64LE(o)); o += 8; o += 32;
  const tlen = d.readUInt32LE(o); o += 4;
  const title = d.slice(o, o + tlen).toString('utf8'); o += tlen;
  const bodyHash = d.slice(o, o + 32); o += 32; o += 8;
  const closesTs = Number(d.readBigInt64LE(o)); o += 8;
  const yes = Number(d.readBigUInt64LE(o)); o += 8;
  const no = Number(d.readBigUInt64LE(o)); o += 8;
  const abstain = Number(d.readBigUInt64LE(o)); o += 8;
  const electorate = o + 8 <= d.length ? Number(d.readBigUInt64LE(o)) : null; o += 8;
  const spendRecipient = o + 32 <= d.length ? new PublicKey(d.slice(o, o + 32)) : null; o += 32;
  const spendAmount = o + 8 <= d.length ? Number(d.readBigUInt64LE(o)) : 0;
  return { id, title, bodyHash, closesTs, yes, no, abstain, electorate, spendRecipient, spendAmount };
}

function programProvider(wallet) {
  return new anchor.AnchorProvider(conn, new anchor.Wallet(wallet), { commitment: 'confirmed' });
}
function program(wallet) {
  return new anchor.Program(loadIdl('zerostate.idl.json'), programProvider(wallet));
}
async function fetchDao(p) { try { return await p.account.dao.fetch(daoPda()); } catch { die('0state is not initialized on this cluster'); } }

async function main() {
  const command = process.argv[2];
  const pos = positionals();
  const wallet = fs.existsSync(kpPath) ? loadWallet() : Keypair.generate();
  const p = program(wallet);
  const me = wallet.publicKey;

  switch (command) {
    case 'address': console.log(me.toBase58()); break;

    case 'status': {
      const dao = await fetchDao(p);
      console.log('0state — an autonomous organization governed by the miners of STATE');
      console.log('  program     ', ZEROSTATE.toBase58());
      console.log('  founder     ', dao.founder.toBase58());
      console.log('  members     ', (await countMiners()) ?? '—', '(miners — every wallet that has mined)');
      console.log('  proposals   ', dao.proposalCount.toString());
      console.log('  voting period', (dao.votingPeriod.toNumber() / 86400).toFixed(0), 'days');
      try {
        const b = await conn.getTokenAccountBalance(ata(treasuryPda(), mintPda()));
        console.log('  treasury    ', Number(b.value.uiAmount).toLocaleString('en-US'), 'STATE (spent only by proposal + vote)');
      } catch { console.log('  treasury    ', '0 STATE'); }
      console.log('');
      console.log('  you         ', me.toBase58());
      const w = await weightFor(me, Math.floor(Date.now() / 1000));
      if (w !== null) {
        console.log('  member      ', 'yes — you have mined (membership is automatic)');
        console.log('  voting weight', w, '(1 + isqrt of active mined STATE; decays if you stop mining)');
      } else {
        console.log('  member      ', 'no — mine STATE first (github.com/maxtindall/0state); membership is then automatic');
      }
      break;
    }

    case 'proposals': {
      const dao = await fetchDao(p);
      const n = dao.proposalCount.toNumber();
      if (n === 0) { console.log('no proposals yet.'); break; }
      const now = Math.floor(Date.now() / 1000);
      for (let id = 0; id < n; id++) {
        const info = await conn.getAccountInfo(proposalPda(id));
        if (!info) continue;
        const pr = decodeProposal(info.data);
        const open = now < pr.closesTs;
        const total = pr.yes + pr.no + pr.abstain;
        console.log(`#${pr.id}  ${pr.title}`);
        console.log(`     ${open ? 'OPEN' : 'closed'} · yes ${pr.yes} · no ${pr.no} · abstain ${pr.abstain} · (weighted; ${total} total)`);
        console.log(`     closes ${new Date(pr.closesTs * 1000).toISOString().slice(0, 16).replace('T', ' ')}Z · electorate ${pr.electorate ?? '?'} · #${pr.id}`);
        if (pr.spendAmount > 0) {
          const passed = !open && pr.yes > pr.no;
          const executed = !!(await conn.getAccountInfo(spentPda(proposalPda(pr.id))));
          console.log(`     SPEND ${(pr.spendAmount / ONE_STATE).toLocaleString('en-US')} STATE -> ${pr.spendRecipient.toBase58()}`
            + `  [${executed ? 'executed' : passed ? 'passed — run `0state execute ' + pr.id + '`' : open ? 'voting' : 'rejected'}]`);
        }
      }
      break;
    }

    case 'propose': {
      const w = loadWallet();
      const title = pos[0];
      if (!title) die('usage: 0state propose "<title>" [--body "text"]');
      if (Buffer.byteLength(title) > 96) die('title too long (max 96 bytes)');
      const bodyHash = [...Buffer.from(keccak256.arrayBuffer(Buffer.from(arg('body', ''))))];
      const dao = await fetchDao(p);
      const id = dao.proposalCount.toNumber();
      console.log(`proposing #${id} "${title}"…`);
      const sig = await p.methods.propose(title, bodyHash, PublicKey.default(), new anchor.BN(0)).accounts({
        proposer: w.publicKey, dao: daoPda(), proof: proofPda(w.publicKey),
        proposal: proposalPda(id), systemProgram: SystemProgram.programId,
      }).rpc();
      console.log(`proposed — this is proposal #${id}`);
      console.log(`  vote:  0state vote ${id} <yes|no|abstain>`);
      console.log(`  tx:    ${sig}`);
      break;
    }

    case 'propose-spend': {
      const w = loadWallet();
      const recipient = new PublicKey(pos[0] || die('usage: 0state propose-spend <recipient> <STATE> "<title>" [--body "text"]'));
      const units = Number(pos[1]);
      const title = pos[2];
      if (!(units > 0)) die("amount (STATE) must be a positive number");
      if (!title) die('usage: 0state propose-spend <recipient> <STATE> "<title>"');
      if (Buffer.byteLength(title) > 96) die('title too long (max 96 bytes)');
      const bodyHash = [...Buffer.from(keccak256.arrayBuffer(Buffer.from(arg('body', ''))))];
      const amount = new anchor.BN(Math.round(units * ONE_STATE).toString());
      const dao = await fetchDao(p);
      const id = dao.proposalCount.toNumber();
      console.log(`proposing spend #${id}: ${units} STATE -> ${recipient.toBase58()}…`);
      const sig = await p.methods.propose(title, bodyHash, recipient, amount).accounts({
        proposer: w.publicKey, dao: daoPda(), proof: proofPda(w.publicKey),
        proposal: proposalPda(id), systemProgram: SystemProgram.programId,
      }).rpc();
      console.log(`proposed — spend proposal #${id}`);
      console.log(`  vote:     0state vote ${id} <yes|no|abstain>`);
      console.log(`  execute (once passed):  0state execute ${id}`);
      console.log(`  tx:       ${sig}`);
      break;
    }

    case 'execute': {
      const w = loadWallet();
      const id = parseInt(pos[0], 10);
      if (Number.isNaN(id)) die('usage: 0state execute <proposal-id>');
      const proposal = proposalPda(id);
      const info = await conn.getAccountInfo(proposal);
      if (!info) die(`proposal #${id} not found`);
      const pr = decodeProposal(info.data);
      if (!(pr.spendAmount > 0)) die(`#${id} is not a spending proposal`);
      const fc = new anchor.Program(loadIdl('state.idl.json'), programProvider(w));
      const mint = mintPda(), treasury = treasuryPda();
      console.log(`executing spend #${id}: ${(pr.spendAmount / ONE_STATE).toLocaleString('en-US')} STATE -> ${pr.spendRecipient.toBase58()}…`);
      const sig = await fc.methods.treasuryWithdraw().accounts({
        caller: w.publicKey, mint, treasury, treasuryAta: ata(treasury, mint),
        recipient: pr.spendRecipient, recipientAta: ata(pr.spendRecipient, mint),
        proposal, spent: spentPda(proposal),
        tokenProgram: TOKEN, associatedTokenProgram: ATA_PROG, systemProgram: SystemProgram.programId,
      }).rpc();
      console.log('executed. the treasury has paid out.', sig);
      break;
    }

    case 'vote': {
      const w = loadWallet();
      const id = parseInt(pos[0], 10);
      const choice = CHOICE[(pos[1] || '').toLowerCase()];
      if (Number.isNaN(id) || choice === undefined) die('usage: 0state vote <id> <yes|no|abstain>');
      const proposal = proposalPda(id);
      const accts = { voter: w.publicKey, proof: proofPda(w.publicKey), proposal, ballot: ballotPda(proposal, w.publicKey), systemProgram: SystemProgram.programId };
      if (process.argv.includes('--offline')) {
        const nonceAcct = await nonceAccountFor(w.publicKey);
        const nonceInfo = await conn.getNonce(nonceAcct);
        if (!nonceInfo) die('no durable nonce — run `0state nonce-init` once (while online) first');
        const ix = await p.methods.vote(choice).accounts(accts).instruction();
        const tx = new Transaction();
        tx.add(SystemProgram.nonceAdvance({ noncePubkey: nonceAcct, authorizedPubkey: w.publicKey }));
        tx.add(ix);
        tx.recentBlockhash = nonceInfo.nonce;
        tx.feePayer = w.publicKey;
        tx.sign(w);
        console.log(`signed offline vote (${CHOICE_NAME[choice]} on #${id}). It stays valid until relayed — carry it over any channel (e.g. a bitchat mesh) and any online peer runs \`0state relay <tx>\`:`);
        console.log(tx.serialize().toString('base64'));
        break;
      }
      console.log(`voting ${CHOICE_NAME[choice]} on #${id}…`);
      const sig = await p.methods.vote(choice).accounts(accts).rpc();
      console.log('voted.', sig);
      break;
    }

    case 'nonce-init': {
      const w = loadWallet();
      const nonceAcct = await nonceAccountFor(w.publicKey);
      if (await conn.getAccountInfo(nonceAcct)) { console.log('durable nonce already set up:', nonceAcct.toBase58()); break; }
      const rent = await conn.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
      const tx = new Transaction().add(
        SystemProgram.createAccountWithSeed({ fromPubkey: w.publicKey, basePubkey: w.publicKey, seed: NONCE_SEED, newAccountPubkey: nonceAcct, lamports: rent, space: NONCE_ACCOUNT_LENGTH, programId: SystemProgram.programId }),
        SystemProgram.nonceInitialize({ noncePubkey: nonceAcct, authorizedPubkey: w.publicKey }),
      );
      console.log('creating your durable nonce (one-time, needs connectivity)…');
      const sig = await programProvider(w).sendAndConfirm(tx);
      console.log('durable nonce ready:', nonceAcct.toBase58(), sig);
      console.log('you can now sign votes offline:  0state vote <id> <choice> --offline');
      break;
    }

    case 'relay': {
      const b64 = pos[0] || die('usage: 0state relay <base64-signed-tx>');
      const raw = Buffer.from(b64, 'base64');
      console.log('relaying a pre-signed transaction to the network…');
      const sig = await conn.sendRawTransaction(raw);
      await conn.confirmTransaction(sig, 'confirmed');
      console.log('relayed + confirmed:', sig);
      break;
    }

    case 'help': case undefined: case '-h': case '--help':
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).slice(1, 20).map(l => l.slice(3)).join('\n'));
      break;

    default: die(`unknown command '${command}' — try: 0state help`);
  }
}
main().catch(e => {
  const m = String(e.message || e);
  const known = /InsufficientLabour|ProofOwnerMismatch|VotingClosed|BadChoice|TitleTooLong|already in use|AccountNotInitialized/.exec(m);
  die(known ? m.split('\n')[0] : m.slice(0, 200));
});
