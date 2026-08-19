# 0state — Governing Framework

**Status: DRAFT for review by counsel. Not legal advice.** This binds the
**0state** on-chain program to a legal entity, so a fully autonomous, trustless
DAO can hold real-world assets, sign contracts, and give its members limited
liability — **without** a board, managers, or shareholders.

0state is, in one line, **CityDAO built communist.** CityDAO's genuine
innovation was legal: a Wyoming DAO wrapper that let a token-governed collective
hold real-world property. 0state keeps that wrapper and inverts its economics.
Where CityDAO issued tradeable Citizen NFTs and parcelled land to private
holders, 0state makes membership **un-buyable** and holds everything **in
common**. There are no parcels. There is no private stake in the commons. The
franchise is earned by labour — by *mining* — and can never be sold.

**Structure: a UNA now → a DUNA at scale.** Form immediately as an
**Unincorporated Nonprofit Association (UNA)** — fast, no filing, no member
minimum, already able to hold property and shield members from liability.
Convert to a **Wyoming DUNA** once 0state reaches its 100-member floor and
deploys to mainnet. The **same on-chain program governs throughout**; the
wrapper is a legal skin.

---

## 1. Two layers
| Layer | What it is | Who controls it |
|---|---|---|
| **The code** | the 0state program — proposals, weighted votes, the commons treasury | the miners, autonomously and trustlessly |
| **The wrapper** | a legal body (UNA → DUNA) that can hold assets & contract | commanded *only* by the code |

The code is the government; the legal entity is the body it commands. Nothing in
the wrapper may override a passed on-chain vote. There is **no Doge here** — 0state
is fully autonomous. (The Doge governs frankcoin, a separate memecoin. 0state
answers only to its miners.)

## 2. The franchise is mined, never bought: STATE
- Membership is held by mining **STATE**, 0state's own proof-of-work token
  (program `2xvfGKpTHy5EA8RFJsKXu73nJVFPRH6YHxDAE5Rh6SVE`). Any wallet holding a
  `Proof` account — i.e. that has mined — is a member. **No application, no
  admission, no fee, no join step.**
- Membership is **non-transferable** — earned by proof-of-work, never bought,
  sold, or gifted, and provable on-chain. Money and the vote are held separately:
  you may trade STATE the token, but trading it conveys none of the franchise,
  because the vote reads the *record of your labour*, not your balance.
- The member set is enumerable off-chain by counting `Proof` accounts.

## 3. Everything is held in common
- **The commons treasury:** one STATE in every ten mined is routed, automatically
  and direct from mining, to a program-controlled account with **no private
  key**. It is the collective fund — the material base of the commune.
- Funds leave **only** by executing a passed 0state spending proposal. No member,
  and no officer of the legal wrapper, may spend or privatise the commons by any
  other means.
- Real-world assets the DUNA acquires — land, equipment, accounts — are held by
  the wrapper **on behalf of the whole membership, undivided.** No parcels, no
  shares, no individual title. From each according to their mining; to the
  commune according to its vote.

## 4. Governance is the on-chain program (binding)
- Authoritative program: `BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9` (devnet
  today; a mainnet address at launch).
- A **proposal that passes** on-chain (voting closed, weighted yes > no) is a
  **binding act of the Association**. No officer or agent may act contrary to it.
- **Voting:** one member, one vote, weighted `1 + √(active mined STATE)` —
  sub-linear so no miner dominates, decaying with inactivity so influence tracks
  current contribution. First-past-the-post at close.

## 5. Status

Devnet. Membership, the commons, and every vote are on the public ledger. Repos:
github.com/maxtindall/0state.
