# 0state

A closed economic commune, run as an artwork — *a computer with assets*. Its
currency is [frankcoin](https://github.com/maxtindall/frankcoin); its members
are miners who were invited in; its decisions are one member, one vote.

    program   CcEbfypSNbA1YKPsW7PVLRQzzEnKKMcPXBL7CxDW9Joz   (devnet)
    site      https://0state.website

## The idea

An economic entity as art. 0state holds assets and governs them collectively —
but not by wealth. Governance is **communist in the literal sense**: power
comes from labour and membership, never from holdings.

- **Mining is the floor.** To be eligible you must have mined frankcoin. The
  franchise reads your on-chain *Proof of work*, not your token balance, so
  holding franks you were given counts for nothing — only franks you mined.
- **Admission is by trust.** Eligibility is not entry. A member is admitted by
  the commune's authority, one at a time. This is a closed commune, not an open
  door, and that is what makes it Sybil-proof: you cannot farm your way into a
  room you are invited to by name.
- **Once inside, everyone is equal.** One member, one vote. No weighting, no
  proposer class. A member who holds nothing has the same voice as one who
  holds a fortune.

## The program

A deliberately small Anchor program. It is the **voting layer only** — it holds
no funds, has no treasury, and cannot move a lamport. Any assets a 0state entity
controls live behind a separate multisig or legal wrapper that treats these
votes as its mandate; they never sit inside this program.

| instruction | who | what |
|---|---|---|
| `initialize` | founder | Found the commune. Once. |
| `admit` | admit authority | Admit a member who has mined. |
| `revoke` | admit authority | Remove a member; close their citizen account. |
| `set_admit_authority` | admit authority | Hand the door to a multisig, or the DAO itself. |
| `propose` | any citizen | Put a question. Body lives off-chain; a hash pins it. |
| `vote` | any citizen | One vote — 0 no, 1 yes, 2 abstain. |

Two structural guarantees, not merely checked but made impossible to violate:

- **The mining gate cannot be forged.** `admit` verifies the member's frankcoin
  Proof through Anchor's `Account<Proof>`, which only deserializes an account
  genuinely owned by the frankcoin program.
- **No one votes twice.** A ballot is a PDA seeded by `(proposal, citizen)`. A
  second vote fails at account creation, not at a check that could be forgotten.

### Layout

    program/
      src/lib.rs                 the program surface
      src/state.rs               Dao · Citizen · Proposal · Ballot
      src/constants.rs           the frankcoin program id, seeds, the labour floor
      src/instructions/          one file per instruction
      test_dao.rs                the litesvm end-to-end test

The program is developed inside the frankcoin Anchor workspace, because it
depends on frankcoin's real `Proof` type to read the mining gate. This directory
is a readable snapshot for auditability.

### Tests

Verified end to end in litesvm: two miners are admitted by the authority; a
wallet that never mined cannot be admitted *even by the authority*; a
non-authority cannot admit anyone; a citizen cannot vote twice; a non-citizen
cannot vote; and revoke is authority-only and closes the account.

## Roadmap

- **Master voting shares** — a second, biometric-NFT voting class above the
  commune, issued by the site or unlocked by holding a threshold of franks. The
  config already reserves space for it.
- **Custody** — when the commune holds real assets, they sit in a multisig
  (e.g. Squads), with these votes as the documented mandate. Never in this
  program.
- **Legal wrapper** — a Wyoming DAO LLC, so the entity can hold funds and,
  eventually, land. This needs a lawyer, not code.

## What this is not

0state is an artwork about how a small economy might govern itself. It runs on
Solana's **devnet**; its franks and its ledger are a test network's and are
worth nothing. Nothing here is an offer, a sale, a security, or financial
advice. Membership is by invitation and sells nothing.

MIT licensed.

*A Max Tindall Inc project.*
