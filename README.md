# 0state

**CityDAO, on Solana.** A commune run as an artwork — *a computer with assets*.
Citizenship is a **Citizen NFT**: mint one, hold it, and holding it is your
membership and your vote. It is freely transferable — trade it and the vote goes
with it. **STATE** is the commune's currency (mine it); it is no longer the
franchise.

    citizen     FVB77ftzfggbdk5tHHB6fE4AzHQrHMjmzXjn8UujypfM   (the Citizen NFT)
    zerostate   BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9   (the vote)
    state       2xvfGKpTHy5EA8RFJsKXu73nJVFPRH6YHxDAE5Rh6SVE   (STATE, the currency)
    site        https://0state.website     ·     memos    https://0state.website/memos

## The idea

An economic entity as art, governed by its citizens. Citizenship is a token you
hold, exactly as CityDAO issued Citizen NFTs — **one NFT, one vote**, tradeable
on any marketplace, so membership itself is a market good.

- **Mint to join.** Anyone may mint a Citizen NFT. Each is a true 1-of-1 (supply
  locked at mint) with Metaplex metadata; the first tranche are **Founding
  Citizens**.
- **Hold it to vote.** Governance reads *current ownership*. Whoever holds the
  NFT at vote time is the citizen — citizenship travels with the token.
- **One NFT, one vote.** No weighting; a holder of several NFTs casts several
  votes.

## The programs

- **`citizen`** — mints transferable Citizen NFTs (supply-1 SPL + Metaplex
  metadata + a `CitizenMarker` PDA so the vote can verify authenticity cheaply).
  Mint proceeds fund the treasury.
- **`zerostate`** — the vote. `propose` / `vote` verify the caller holds a
  genuine Citizen NFT; a ballot is keyed to the NFT (so each NFT votes once).
- **`state`** — STATE, the commune's currency: proof-of-work mined, uncapped,
  with a commons treasury (10% levy) spent only by a passed vote.

frankcoin (the memecoin) is unrelated and lives in
[its own repo](https://github.com/maxtindall/frankcoin).

## Layout

    programs/citizen/     the Citizen NFT program
    programs/zerostate/   the vote (reads Citizen NFT ownership)
    programs/state/       STATE, the mined currency + commons treasury
    cli/                  `0state` terminal + `statemine` currency miner
    site/                 0state.website (+ /memos, citizen NFT metadata)
    Anchor.toml           workspace: citizen + zerostate + state, devnet

A **buildable mirror** of the deployed devnet programs:

    anchor build --ignore-keys

## Take part

    brew tap maxtindall/frankcoin && brew trust maxtindall/frankcoin
    brew install maxtindall/frankcoin/0state    # installs `0state` + `statemine`
    0state mint                                 # mint your Citizen NFT
    0state status                               # the commune, and your citizenship
    0state propose "<title>"
    0state vote <id> yes|no|abstain             # votes with your Citizen NFT
    statemine                                   # (optional) mine the STATE currency
    brew upgrade maxtindall/frankcoin/0state

Signing happens locally with your own Solana keypair; nothing is custodied.

## What this is not

An artwork about how a small economy might govern itself. It runs on Solana's
**devnet**; its Citizen NFTs, STATE, and ledger are a test network's and are
worth nothing. Nothing here is an offer, a sale, a security, or financial advice.

MIT licensed. See [GOVERNANCE.md](GOVERNANCE.md).

*A Max Tindall Inc project.*
