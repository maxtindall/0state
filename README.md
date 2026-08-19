# 0state

CityDAO, built communist — a closed economic commune run as an artwork, *a
computer with assets*. Its franchise is **STATE**, a token you can only get by
mining; its members are its miners; its assets are held in common; its decisions
are made by weighted vote of labour, never of wealth.

    state       2xvfGKpTHy5EA8RFJsKXu73nJVFPRH6YHxDAE5Rh6SVE   (devnet · the STATE token)
    zerostate   BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9   (devnet · the vote)
    site        https://0state.website
    memos       https://0state.website/memos

## The idea

An economic entity as art. 0state holds assets and governs them collectively —
but not by wealth. Governance is **communist in the literal sense**: power comes
from labour, never from holdings.

- **The franchise is mined, never bought.** To be a citizen you must have mined
  STATE. The vote reads your on-chain *Proof of work*, not your token balance, so
  holding STATE you were given counts for nothing — only STATE you mined. You may
  trade the token freely; trading it conveys none of the franchise.
- **Membership is automatic.** Having mined a single STATE proof makes you a
  citizen — no application, no admitting authority, no join step. The member set
  is just the set of miners, enumerable on-chain.
- **Everything is held in common.** One STATE in every ten mined is routed to a
  keyless commons treasury; it leaves only by a passed vote. Real-world assets a
  0state legal wrapper acquires are held undivided — no parcels, no private stake.

## The two programs

0state is two small Anchor programs. **frankcoin** (the memecoin) is unrelated
and lives in [its own repo](https://github.com/maxtindall/frankcoin).

### `state` — the mined franchise (and the commons)

A proof-of-work token. Minted from zero, no admin inflation, fully autonomous —
no steward, no owner, no privileged key. Uncapped: the reward halves across a
distribution phase, then floors at a perpetual 1-per-proof tail. Ten percent of
every reward is minted to the commons treasury, spendable only by a passed
0state vote.

| instruction | who | what |
|---|---|---|
| `initialize` | founder | Create the mint + config. Once. |
| `register` / `mine` | any wallet | Mine STATE. One accepted proof makes you a citizen. |
| `treasury_withdraw` | anyone | Enact a *passed* 0state spending proposal. Single-use. |

### `zerostate` — the vote

The voting layer only — it holds no funds and cannot move a lamport. Membership
and weight are read live from a citizen's STATE `Proof`.

| instruction | who | what |
|---|---|---|
| `initialize` | founder | Found the commune. Once. |
| `propose` | any citizen | Put a question. Body off-chain, pinned by hash. Spending proposals name a recipient + amount. |
| `vote` | any citizen | One weighted vote — 0 no, 1 yes, 2 abstain. |

Two structural guarantees, made impossible to violate:

- **The mining gate cannot be forged.** Voting weight is read through a `Proof`
  account proven to be owned by the `state` program — never a token balance.
- **No one votes twice.** A ballot is a PDA seeded by `(proposal, citizen)`; a
  second vote fails at account creation.

**Voting weight** is `1 + √(active mined STATE)` — sub-linear, so no miner
dominates, and decaying with inactivity, so influence tracks recent labour.
First-past-the-post at close.

## Layout

    programs/state/       the STATE proof-of-work token + commons treasury
    programs/zerostate/   the voting layer (reads STATE proofs)
    cli/                  the `0state` terminal and the `statemine` miner
    site/                 0state.website (+ /memos)
    Anchor.toml           workspace: state + zerostate, devnet

This repo is a **buildable mirror of the deployed devnet programs.** Reproduce it:

    anchor build --ignore-keys

The resulting `state.so` / `zerostate.so` and IDL addresses match what is on
devnet. (Use `--ignore-keys`; the program IDs are fixed in source.)

## Take part

    brew tap maxtindall/frankcoin && brew trust maxtindall/frankcoin
    brew install maxtindall/frankcoin/0state    # installs `0state` + `statemine`
    statemine                                   # mine STATE → become a citizen
    0state status                               # the commune, and your standing
    0state propose "<title>" --body "…"
    0state vote <id> yes|no|abstain
    brew upgrade maxtindall/frankcoin/0state     # pull updates

Signing happens locally with your own Solana keypair; nothing is custodied.

## What this is not

0state is an artwork about how a small economy might govern itself. It runs on
Solana's **devnet**; its STATE tokens and its ledger are a test network's and are
worth nothing. Nothing here is an offer, a sale, a security, or financial advice.

MIT licensed. See [GOVERNANCE.md](GOVERNANCE.md) for the legal framing (UNA → DUNA).

*A Max Tindall Inc project.*
