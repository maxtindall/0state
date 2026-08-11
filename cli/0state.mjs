#!/usr/bin/env node
// 0state — command-line client (v2, miners-only).
//
// 0state is a political organization governed by the miners of frankcoin.
// franks are a currency; the vote is earned only by mining and cannot be traded.
// Membership is permissionless: mine, then `join`. Voting weight is sub-linear
// in franks mined and decays with inactivity. Signs with YOUR keypair.
//
// Usage:
//   0state status                       the organization, and your standing
//   0state address       [--key PATH]   the wallet this would act as
//   0state join          [--key PATH]   become a member (must have mined)
//   0state proposals                    list proposals and weighted tallies
//   0state propose "<title>" [--body S] put a question (members only)
//   0state vote <id> <yes|no|abstain>   cast your weighted vote (members only)
//
// Options:  --key PATH  keypair (default ~/.config/solana/id.json)
//           --rpc URL   cluster (default devnet)   env: FRANK_RPC

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sha3 from 'js-sha3';
const { keccak256 } = sha3;
import anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ZEROSTATE = new PublicKey('BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9');
const FRANKCOIN = new PublicKey('61yBp4FQSXq6qxS1Scny8LRBNDLDoNQBKupofVSyyHL8');
const ONE_FRANK = 1_000_000_000;
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
const memberPda = (w) => pda([Buffer.from('member'), w.toBuffer()]);
const proposalPda = (id) => pda([Buffer.from('proposal'), u64le(id)]);
const ballotPda = (proposal, member) => pda([Buffer.from('ballot'), proposal.toBuffer(), member.toBuffer()]);
const proofPda = (w) => pda([Buffer.from('proof'), w.toBuffer()], FRANKCOIN);

const CHOICE = { no: 0, yes: 1, abstain: 2 };
const CHOICE_NAME = ['no', 'yes', 'abstain'];

function isqrt(n) { if (n < 2n) return n; let x = n, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; }

// Read the frankcoin Proof account raw (v2's IDL doesn't expose it) and compute
// the voter's weight exactly as the program does, for display.
async function weightFor(wallet, nowSec) {
  const info = await conn.getAccountInfo(proofPda(wallet));
  if (!info) return null;
  const d = info.data;            // 8 disc + miner(32) + challenge(32) + last_claim(i64) + total_mined(u64) + count(u64)
  const lastClaim = Number(d.readBigInt64LE(8 + 64));
  const total = d.readBigUInt64LE(8 + 64 + 8);
  const whole = total / BigInt(ONE_FRANK);
  const idle = Math.max(0, nowSec - lastClaim);
  const halvings = BigInt(Math.min(Math.floor(idle / HALF_LIFE), 63));
  return (1n + isqrt(whole >> halvings)).toString();
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
  const electorate = o + 8 <= d.length ? Number(d.readBigUInt64LE(o)) : null;
  return { id, title, bodyHash, closesTs, yes, no, abstain, electorate };
}

function program(wallet) {
  const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(wallet), { commitment: 'confirmed' });
  return new anchor.Program(loadIdl('zerostate.idl.json'), provider);
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
      console.log('0state — a political organization governed by the miners of frankcoin');
      console.log('  program     ', ZEROSTATE.toBase58());
      console.log('  founder     ', dao.founder.toBase58());
      console.log('  members     ', dao.memberCount.toString());
      console.log('  proposals   ', dao.proposalCount.toString());
      console.log('  voting period', (dao.votingPeriod.toNumber() / 86400).toFixed(0), 'days');
      console.log('');
      console.log('  you         ', me.toBase58());
      const member = await p.account.member.fetchNullable(memberPda(me));
      const proofInfo = await conn.getAccountInfo(proofPda(me));
      if (member) {
        const w = (await weightFor(me, Math.floor(Date.now() / 1000))) ?? '—';
        console.log('  member      ', `yes — joined ${new Date(member.joinedTs.toNumber() * 1000).toISOString().slice(0, 10)}, votes cast ${member.votesCast}`);
        console.log('  voting weight', w, '(1 + isqrt of active mined franks; decays if you stop mining)');
      } else if (proofInfo) {
        console.log('  member      ', 'no — you have mined; run `0state join` to become a member');
      } else {
        console.log('  member      ', 'no — mine frankcoin first (frankcoin.website), then `0state join`');
      }
      break;
    }

    case 'join': {
      const w = loadWallet();
      console.log('joining as', w.publicKey.toBase58(), '…');
      const sig = await p.methods.join().accounts({
        wallet: w.publicKey, dao: daoPda(), proof: proofPda(w.publicKey),
        member: memberPda(w.publicKey), systemProgram: SystemProgram.programId,
      }).rpc();
      console.log('joined. you are a member.', sig);
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
      const sig = await p.methods.propose(title, bodyHash).accounts({
        proposer: w.publicKey, dao: daoPda(), member: memberPda(w.publicKey),
        proposal: proposalPda(id), systemProgram: SystemProgram.programId,
      }).rpc();
      console.log(`proposed — this is proposal #${id}`);
      console.log(`  vote:  0state vote ${id} <yes|no|abstain>`);
      console.log(`  tx:    ${sig}`);
      break;
    }

    case 'vote': {
      const w = loadWallet();
      const id = parseInt(pos[0], 10);
      const choice = CHOICE[(pos[1] || '').toLowerCase()];
      if (Number.isNaN(id) || choice === undefined) die('usage: 0state vote <id> <yes|no|abstain>');
      const proposal = proposalPda(id);
      const member = memberPda(w.publicKey);
      console.log(`voting ${CHOICE_NAME[choice]} on #${id}…`);
      const sig = await p.methods.vote(choice).accounts({
        voter: w.publicKey, member, proof: proofPda(w.publicKey), proposal,
        ballot: ballotPda(proposal, member), systemProgram: SystemProgram.programId,
      }).rpc();
      console.log('voted.', sig);
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
