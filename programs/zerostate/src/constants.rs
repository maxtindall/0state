use anchor_lang::prelude::*;

/// The STATE program. Membership and voting weight are proven by presenting
/// a Proof account owned by this program — mining is the only qualification.
pub const STATE_PROGRAM: Pubkey = pubkey!("2xvfGKpTHy5EA8RFJsKXu73nJVFPRH6YHxDAE5Rh6SVE");

/// Base units in one STATE (STATE has 9 decimals).
pub const ONE_STATE: u64 = 1_000_000_000;

// PDA seeds
pub const DAO_SEED: &[u8] = b"dao";
pub const PROPOSAL_SEED: &[u8] = b"proposal";
pub const BALLOT_SEED: &[u8] = b"ballot";
/// STATE's per-miner Proof seed. 0state derives the same PDA under
/// STATE_PROGRAM to *read* a member's proof-of-mining — it never writes it.
/// Vendored here so 0state builds with no dependency on the STATE crate.
pub const PROOF_SEED: &[u8] = b"proof";

/// The floor of labour to join: at least one accepted proof. You must have
/// actually mined — the gate reads the Proof account, never a token balance, so
/// holding or being gifted STATE cannot buy the franchise.
pub const MIN_PROOFS_TO_JOIN: u64 = 1;

/// How long a member's mining weight takes to halve once they stop mining.
/// Standing tracks *recent* labour: keep mining and your weight holds; stop and
/// it decays toward the base vote. 90 days.
pub const HALF_LIFE_SECS: i64 = 90 * 24 * 60 * 60;

/// A proposal is open for this long.
pub const DEFAULT_VOTING_PERIOD: i64 = 3 * 24 * 60 * 60; // three days

/// Max on-chain title length; the body lives off-chain, pinned by its hash.
pub const MAX_TITLE_LEN: usize = 96;
