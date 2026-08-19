# 0state — Governing Framework

**Status: DRAFT for review by counsel. Not legal advice.** This binds the
**0state** on-chain program to a legal entity, so a token-governed collective can
hold real-world assets, sign contracts, and give its members limited liability.

0state is **CityDAO, on Solana.** Citizenship is a **Citizen NFT**: mint one,
hold it, and holding it is your membership and your vote — **one NFT, one vote.**
The NFT is freely transferable, so citizenship can be bought, sold, and traded on
any marketplace, exactly as CityDAO's Citizen NFTs were. Mint proceeds fund the
commons treasury.

**Structure: a UNA now → a DUNA / Wyoming DAO LLC at scale.** Form as an
Unincorporated Nonprofit Association today; convert to a Wyoming DAO LLC (as
CityDAO did) once the membership and assets justify it. The **same on-chain
program governs throughout**; the wrapper is a legal skin.

---

## 1. Two layers
| Layer | What it is | Who controls it |
|---|---|---|
| **The code** | the citizen + zerostate programs — Citizen NFTs, proposals, weighted votes | the Citizen NFT holders |
| **The wrapper** | a legal body (UNA → DAO LLC) that can hold assets & contract | commanded *only* by the code |

Nothing in the wrapper may override a passed on-chain vote.

## 2. Citizenship is a transferable NFT

- **Mint to join.** Anyone may mint a Citizen NFT (`citizen` program
  `FVB77ftzfggbdk5tHHB6fE4AzHQrHMjmzXjn8UujypfM`). It is a true 1-of-1 SPL NFT
  with Metaplex metadata, and each carries a `CitizenMarker` PDA that proves it
  genuine. The first tranche are **Founding Citizens**.
- **Hold it to vote.** Governance reads *current ownership* of a Citizen NFT.
  Whoever holds the NFT at vote time is the citizen — so citizenship travels with
  the token when it is traded.
- **One NFT, one vote.** No weighting by wealth or by anything else; each Citizen
  NFT is exactly one vote, and a holder of several NFTs casts several votes.

## 3. Assets & treasury

- **Commons treasury:** the commune's spendable fund is held in STATE (the
  0state currency), topped up by the mining levy, and released only by executing
  a passed spending proposal. Citizen-NFT holders vote; anyone may then enact it.
- **Mint proceeds:** Citizen NFT sales (0 on devnet) accrue to a program-owned
  treasury for the commune.
- Real-world assets the DAO LLC acquires are held by the wrapper as the
  membership's mandate, documented by these on-chain votes.

## 4. Governance is the on-chain program (binding)

- Voting program: `BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9`.
- A **proposal that passes** on-chain (voting closed, yes > no) is a binding act
  of the Association. A ballot is keyed to the *NFT*, so each Citizen NFT votes at
  most once per proposal.
- **STATE** remains the commune's currency (mine it with `statemine`); it is no
  longer the franchise. Money and the vote are now the *same* transferable asset
  only in the sense that the vote — the Citizen NFT — is itself a tradeable good.

## 5. Status

Devnet. Citizen NFTs and the ledger are a test network's and are worth nothing.
Nothing here is an offer, a sale, a security, or financial advice. Repos:
github.com/maxtindall/0state.
