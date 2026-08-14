# 0state — Governing Framework

**Status: DRAFT for review by counsel. Not legal advice.** This is the proposed
governing document that binds the **0state** on-chain program to a legal entity,
so a fully autonomous, trustless DAO can hold real-world assets, sign contracts,
and give its members limited liability — **without** a board, managers, or
shareholders.

**Structure: a UNA now → a DUNA at scale.** Form immediately as an
**Unincorporated Nonprofit Association (UNA)** — fast, no filing, no member
minimum, and it can already hold property and shield members from liability
(under the Uniform Unincorporated Nonprofit Association Act, adopted in Wyoming
and others). Convert to a **Wyoming DUNA** — the crypto-native, DAO-specific
statute — once 0state reaches its 100-member floor and deploys to mainnet. The
**same on-chain program governs throughout**; the wrapper is a legal skin, so
the upgrade costs nothing technical.

---

## 1. Two layers
| Layer | What it is | Who controls it |
|---|---|---|
| **The code** | the 0state program — proposals, weighted votes, treasury | the miners, autonomously and trustlessly |
| **The wrapper** | a legal body (UNA → DUNA) that can hold assets & contract | commanded *only* by the code |

The code is the government; the legal entity is the body it commands. Nothing in
the wrapper may override a passed on-chain vote.

## 2. Form now: the UNA
- **Formation:** a UNA exists the moment two or more members associate for a
  common nonprofit purpose. **No state filing is required** (an optional
  "statement of authority" may be recorded to name who can transfer real
  property).
- **Powers:** in adopting states a UNA is a legal person separate from its
  members — it may **acquire and hold real and personal property, enter
  contracts, open accounts, and sue or be sued** in its own name.
- **Limited liability:** members are **not** personally liable for the
  Association's debts merely by being members.
- **No member minimum**, so 0state can begin holding assets today.

## 3. Membership = the miners (automatic)
- Any wallet that has mined frankcoin (holds a `Proof` account) is a member.
  **No application, no admission, no fee, no join step.**
- Membership is **non-transferable** — earned by proof-of-work, never bought,
  sold, or gifted, and provable on-chain.
- The member set is enumerable off-chain by counting `Proof` accounts.

## 4. Governance is the on-chain program (binding)
- Authoritative program: `BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9` (devnet
  today; a mainnet address at launch).
- A **proposal that passes** on-chain (voting closed, weighted yes > no) is a
  **binding act of the Association**, with the force of a duly adopted member
  resolution. No officer or agent may act contrary to it.
- **Voting:** one member, one vote, weighted `1 + √(active mined franks)` —
  sub-linear so no miner dominates, decaying with inactivity so influence tracks
  current contribution. First-past-the-post at close.

## 5. Assets & treasury
- **On-chain treasury:** a program-controlled account (no private key) receives
  10% of every mined reward. Funds leave **only** by executing a passed spending
  proposal (`treasury_withdraw`) — recipient and amount fixed by the vote,
  single-use, replay-guarded.
- **Off-chain assets:** the Association may hold real property, bank accounts,
  intellectual property, and contractual rights in its own name, **controlled by
  binding on-chain vote**.
- **Execution of off-chain acts:** where an act cannot happen purely on-chain
  (signing a deed, wiring fiat), the Association acts through an **agent
  designated by proposal** — a ministerial instrument of the vote with no
  discretion, bound to the mandate, removable by proposal. This is not
  management and does not re-centralize the DAO.

## 6. Registered agent (DUNA phase only)
A UNA needs no registered agent to exist. Upon converting to a DUNA, Wyoming
requires a **registered agent** for service of process — a **legal contact
only**, with no governance power, unable to bind or direct the Association.

## 7. Upgrade path: UNA → DUNA
Convert to a **Wyoming Decentralized Unincorporated Nonprofit Association**
(effective July 1, 2024) when the DAO matures, for DAO-specific statutory
recognition of on-chain governance and stronger, purpose-built protections.
Requirements to convert:
1. **≥100 members** (100 distinct miners).
2. **Mainnet deployment** with the program's upgrade authority revoked
   (immutable governance).
3. Appoint a Wyoming registered agent and **file** the DUNA registration.

## 8. Formation checklist
**Today (UNA):**
1. Adopt this governing document by an on-chain proposal that ratifies it.
2. (Optional) record a statement of authority naming the agent(s) who may
   transact real property, each acting only pursuant to a passed proposal.
3. Open the Association's accounts; begin holding assets.

**At scale (DUNA):** reach 100 members → mainnet + revoke upgrade authority →
appoint registered agent → file with the Wyoming Secretary of State.

## 9. Amendments
Amendable **only** by a passed proposal referencing the amendment text (pinned by
its on-chain body-hash). No off-chain party may amend it.

## 10. Disclaimers
Devnet assets carry no value. Nothing here is an offer, solicitation, security,
or tax/legal advice. Review and finalize with qualified counsel before any
filing or reliance.

---

_Bridge summary: the **code** is the government; the **UNA** (today) or **DUNA**
(at scale) is the legal body it commands. Members = miners; passed votes =
binding acts; the treasury and any real-world assets move only by vote._
