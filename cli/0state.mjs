#!/usr/bin/env node
// 0state — command-line client (v3, CityDAO model).
//
// 0state is a CityDAO-style commune on Solana. Citizenship is a transferable
// Citizen NFT: mint one, hold it, and holding it is your vote — one NFT, one
// vote. Trade it and the vote travels with it. STATE is the commune's currency
// (mine it with `statemine`); it is no longer the franchise. Signs with YOUR
// keypair — no custody.
//
// Usage:
//   0state status                        the commune, and whether you're a citizen
//   0state address        [--key PATH]   the wallet this would act as
//   0state mint                          mint a Citizen NFT to your wallet
//   0state proposals                     list proposals and tallies
//   0state propose "<title>" [--body S]  put a question (citizens only)
//   0state propose-spend <to> <STATE> "<title>"   propose a commons-treasury spend
//   0state vote <id> <yes|no|abstain>    vote with your Citizen NFT
//   0state execute <id>                  enact a passed spending proposal
//
// Options:  --key PATH  keypair (default ~/.config/solana/id.json)
//           --rpc URL   cluster (default devnet)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ZEROSTATE = new PublicKey('BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9');
const CITIZEN = new PublicKey('FVB77ftzfggbdk5tHHB6fE4AzHQrHMjmzXjn8UujypfM');
const STATE = new PublicKey('2xvfGKpTHy5EA8RFJsKXu73nJVFPRH6YHxDAE5Rh6SVE');
const TOKEN = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROG = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const META = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const ONE_STATE = 1_000_000_000;

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : def; }
function positionals() { const out = []; const a = process.argv.slice(3); for (let i = 0; i < a.length; i++) { if (a[i].startsWith('--')) { i++; continue; } out.push(a[i]); } return out; }

const rpc = arg('rpc', process.env.FRANK_RPC || 'https://api.devnet.solana.com');
const kpPath = (arg('key', process.env.HOME + '/.config/solana/id.json')).replace(/^~/, process.env.HOME);
const conn = new Connection(rpc, 'confirmed');

function die(msg) { console.error('0state: ' + msg); process.exit(1); }
function loadWallet() { try { return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpPath)))); } catch (e) { die(`could not read keypair ${kpPath} — ${e.message}`); } }
function loadIdl(n) { return JSON.parse(fs.readFileSync(path.join(HERE, n))); }
function provider(w) { return new anchor.AnchorProvider(conn, new anchor.Wallet(w), { commitment: 'confirmed' }); }

const zp = (seeds) => PublicKey.findProgramAddressSync(seeds, ZEROSTATE)[0];
const cp = (seeds) => PublicKey.findProgramAddressSync(seeds, CITIZEN)[0];
const sp = (seeds) => PublicKey.findProgramAddressSync(seeds, STATE)[0];
const u64le = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const ata = (owner, mint) => PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROG)[0];
const daoPda = () => zp([Buffer.from('dao')]);
const proposalPda = (id) => zp([Buffer.from('proposal'), u64le(id)]);
const markerPda = (mint) => cp([Buffer.from('citizen'), mint.toBuffer()]);
const metadataPda = (mint) => PublicKey.findProgramAddressSync([Buffer.from('metadata'), META.toBuffer(), mint.toBuffer()], META)[0];

const CHOICE = { no: 0, yes: 1, abstain: 2 };

// Find a Citizen NFT the wallet holds: an amount-1, decimals-0 token whose mint
// carries a citizen marker. Returns { mint, tokenAccount } or null.
async function findCitizenNFT(owner) {
  const res = await conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN });
  for (const { pubkey, account } of res.value) {
    const info = account.data.parsed.info;
    if (info.tokenAmount.amount !== '1' || info.tokenAmount.decimals !== 0) continue;
    const mint = new PublicKey(info.mint);
    if (await conn.getAccountInfo(markerPda(mint))) return { mint, tokenAccount: pubkey };
  }
  return null;
}

async function citizenCount() {
  try {
    const c = new anchor.Program(loadIdl('citizen.idl.json'), provider(Keypair.generate()));
    const cfg = await c.account.config.fetch(cp([Buffer.from('config')]));
    return cfg.citizenCount.toString();
  } catch { return null; }
}

function decodeProposal(d) {
  let o = 8 + 1;
  const id = Number(d.readBigUInt64LE(o)); o += 8; o += 32;
  const tlen = d.readUInt32LE(o); o += 4;
  const title = d.slice(o, o + tlen).toString('utf8'); o += tlen;
  o += 32; o += 8;
  const closesTs = Number(d.readBigInt64LE(o)); o += 8;
  const yes = Number(d.readBigUInt64LE(o)); o += 8;
  const no = Number(d.readBigUInt64LE(o)); o += 8;
  const abstain = Number(d.readBigUInt64LE(o)); o += 8; o += 8;
  const spendRecipient = new PublicKey(d.slice(o, o + 32)); o += 32;
  const spendAmount = Number(d.readBigUInt64LE(o));
  return { id, title, closesTs, yes, no, abstain, spendRecipient, spendAmount };
}

async function requireCitizen(owner) {
  const c = await findCitizenNFT(owner);
  if (!c) die('you are not a citizen — mint a Citizen NFT first:  0state mint');
  return c;
}

async function main() {
  const command = process.argv[2];
  const pos = positionals();
  const wallet = fs.existsSync(kpPath) ? loadWallet() : Keypair.generate();
  const me = wallet.publicKey;
  const zero = new anchor.Program(loadIdl('zerostate.idl.json'), provider(wallet));

  switch (command) {
    case 'address': console.log(me.toBase58()); break;

    case 'status': {
      const dao = await zero.account.dao.fetch(daoPda()).catch(() => die('0state is not initialized on this cluster'));
      console.log('0state — a CityDAO-style commune; citizenship is a transferable Citizen NFT');
      console.log('  vote program', ZEROSTATE.toBase58());
      console.log('  citizen NFT ', CITIZEN.toBase58());
      console.log('  founder     ', dao.founder.toBase58());
      console.log('  citizens    ', (await citizenCount()) ?? '—', '(minted Citizen NFTs)');
      console.log('  proposals   ', dao.proposalCount.toString());
      console.log('  voting period', (dao.votingPeriod.toNumber() / 86400).toFixed(0), 'days');
      try {
        const b = await conn.getTokenAccountBalance(ata(sp([Buffer.from('treasury')]), sp([Buffer.from('mint')])));
        console.log('  treasury    ', Number(b.value.uiAmount).toLocaleString('en-US'), 'STATE (spent only by proposal + vote)');
      } catch { console.log('  treasury    ', '0 STATE'); }
      console.log('');
      console.log('  you         ', me.toBase58());
      const c = await findCitizenNFT(me);
      if (c) console.log('  citizen     ', 'yes — you hold Citizen NFT', c.mint.toBase58());
      else console.log('  citizen     ', 'no — mint one:  0state mint');
      break;
    }

    case 'mint': {
      const w = loadWallet();
      const citizen = new anchor.Program(loadIdl('citizen.idl.json'), provider(w));
      const config = cp([Buffer.from('config')]);
      const mint = Keypair.generate();
      console.log('minting your Citizen NFT…');
      const sig = await citizen.methods.mintCitizen().accounts({
        minter: w.publicKey, config, mint: mint.publicKey,
        minterAta: ata(w.publicKey, mint.publicKey), marker: markerPda(mint.publicKey),
        metadata: metadataPda(mint.publicKey), treasury: cp([Buffer.from('treasury')]),
        tokenProgram: TOKEN, associatedTokenProgram: ATA_PROG, tokenMetadataProgram: META,
        systemProgram: SystemProgram.programId, rent: SYSVAR_RENT_PUBKEY,
      }).signers([mint]).rpc();
      console.log('you are a citizen. Citizen NFT:', mint.publicKey.toBase58());
      console.log('  ', sig);
      break;
    }

    case 'proposals': {
      const dao = await zero.account.dao.fetch(daoPda());
      const n = dao.proposalCount.toNumber();
      if (n === 0) { console.log('no proposals yet.'); break; }
      const now = Math.floor(Date.now() / 1000);
      for (let id = 0; id < n; id++) {
        const info = await conn.getAccountInfo(proposalPda(id));
        if (!info) continue;
        const pr = decodeProposal(info.data);
        const open = now < pr.closesTs;
        console.log(`#${pr.id}  ${pr.title}  [${open ? 'open' : 'closed'}]`);
        console.log(`     yes ${pr.yes} · no ${pr.no} · abstain ${pr.abstain}  (1 NFT = 1 vote)`);
        if (pr.spendAmount > 0) console.log(`     SPEND ${(pr.spendAmount / ONE_STATE).toLocaleString('en-US')} STATE -> ${pr.spendRecipient.toBase58()}`);
      }
      break;
    }

    case 'propose':
    case 'propose-spend': {
      const w = loadWallet();
      const c = await requireCitizen(w.publicKey);
      let title, recipient = PublicKey.default, amount = new anchor.BN(0);
      if (command === 'propose-spend') {
        recipient = new PublicKey(pos[0] || die('usage: 0state propose-spend <recipient> <STATE> "<title>"'));
        const units = Number(pos[1]); title = pos[2];
        if (!(units > 0)) die('amount (STATE) must be positive');
        amount = new anchor.BN(Math.round(units * ONE_STATE).toString());
      } else { title = pos[0]; }
      if (!title) die('usage: 0state propose "<title>" [--body "text"]');
      if (Buffer.byteLength(title) > 96) die('title too long (max 96 bytes)');
      const bodyHash = [...Buffer.from(new Uint8Array(32))]; // body pinning optional in v3
      const dao = await zero.account.dao.fetch(daoPda());
      const id = dao.proposalCount.toNumber();
      console.log(`proposing #${id} as citizen…`);
      const sig = await zero.methods.propose(title, bodyHash, recipient, amount).accounts({
        proposer: w.publicKey, dao: daoPda(), citizenMint: c.mint, proposerToken: c.tokenAccount,
        marker: markerPda(c.mint), proposal: proposalPda(id), systemProgram: SystemProgram.programId,
      }).rpc();
      console.log(`proposed #${id}.`, sig);
      break;
    }

    case 'vote': {
      const w = loadWallet();
      const id = parseInt(pos[0], 10);
      const choice = CHOICE[pos[1]];
      if (Number.isNaN(id) || choice === undefined) die('usage: 0state vote <id> <yes|no|abstain>');
      const c = await requireCitizen(w.publicKey);
      const proposal = proposalPda(id);
      const ballot = zp([Buffer.from('ballot'), proposal.toBuffer(), c.mint.toBuffer()]);
      const sig = await zero.methods.vote(choice).accounts({
        voter: w.publicKey, citizenMint: c.mint, voterToken: c.tokenAccount, marker: markerPda(c.mint),
        proposal, ballot, systemProgram: SystemProgram.programId,
      }).rpc();
      console.log(`voted ${pos[1]} on #${id} with Citizen NFT ${c.mint.toBase58()}.`, sig);
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
      const st = new anchor.Program(loadIdl('state.idl.json'), provider(w));
      const mint = sp([Buffer.from('mint')]), treasury = sp([Buffer.from('treasury')]);
      const sig = await st.methods.treasuryWithdraw().accounts({
        caller: w.publicKey, mint, treasury, treasuryAta: ata(treasury, mint),
        recipient: pr.spendRecipient, recipientAta: ata(pr.spendRecipient, mint),
        proposal, spent: sp([Buffer.from('spent'), proposal.toBuffer()]),
        tokenProgram: TOKEN, associatedTokenProgram: ATA_PROG, systemProgram: SystemProgram.programId,
      }).rpc();
      console.log('executed. the commons treasury has paid out.', sig);
      break;
    }

    default:
      console.log('0state — a CityDAO-style commune. Citizenship is a transferable Citizen NFT.');
      console.log('commands: status · mint · proposals · propose · propose-spend · vote · execute · address');
      console.log('mine the STATE currency with:  statemine');
  }
}
main().catch(e => { console.error('0state:', e.message || e); process.exit(1); });
