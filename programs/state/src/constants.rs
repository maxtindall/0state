use anchor_lang::prelude::*;

/// STATE has 9 decimals (SPL standard).
#[constant]
pub const DECIMALS: u8 = 9;

/// Base units in one STATE: 10^9.
pub const ONE_STATE: u64 = 1_000_000_000;

/// The size of the distribution phase, in base units (1,000,000,000 STATE).
/// This is NOT a cap — mining never stops. It only shapes the halving schedule:
/// the reward halves across tranches that together span this much supply, after
/// which emission settles to a perpetual tail. Roughly a billion STATE are
/// issued on the steep part of the curve, exactly as under the old fixed cap;
/// then issuance continues forever at TAIL_REWARD.
pub const DISTRIBUTION_PHASE: u64 = 1_000_000_000 * ONE_STATE;

/// Genesis reward per accepted proof, in base units (500 STATE). Halves each
/// supply tranche across the distribution phase, then floors at TAIL_REWARD.
pub const INITIAL_REWARD: u64 = 500 * ONE_STATE;

/// The perpetual tail: once the halving schedule decays to it, every accepted
/// proof mints exactly this much — 1 STATE — forever. Emission never stops, but
/// because the tail is a *fixed absolute* amount, percentage inflation falls
/// toward zero as total supply grows (Monero's model). This is what lets an
/// uncapped coin stay sound: asymptotically-zero inflation plus proof-of-work
/// production cost. It also replaces lost coins and funds perpetual mining.
pub const TAIL_REWARD: u64 = 1 * ONE_STATE;

// ---- Difficulty retargeting -------------------------------------------------
// Difficulty is no longer fixed. It floats toward a target issuance *pace*, so
// STATE are minted on a predictable schedule regardless of how much hashpower
// shows up, and the marginal cost to produce one rises as miners compete — a
// production-cost floor under the price.

/// Target seconds between accepted proofs, network-wide. Retargeting nudges
/// difficulty so the observed pace tracks this.
pub const TARGET_INTERVAL_SECS: i64 = 60;

/// Retarget every this many accepted proofs (one difficulty-adjustment window).
pub const RETARGET_INTERVAL: u64 = 20;

/// Difficulty moves by at most ±1 bit per window, and only when the observed
/// pace is off target by more than 2×, so it can't oscillate wildly. It never
/// falls below the genesis difficulty (stored as `min_difficulty`) and never
/// rises past this ceiling (a valid nonce stays findable within a u64).
pub const MAX_DIFFICULTY: u8 = 56;

// PDA seeds
pub const CONFIG_SEED: &[u8] = b"config";
pub const MINT_SEED: &[u8] = b"mint";
pub const PROOF_SEED: &[u8] = b"proof";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const SPENT_SEED: &[u8] = b"spent";

/// The DAO levy: 1 STATE in every 10 mined is routed to the treasury. The
/// reward is divided by this to get the treasury's cut (10 = 10%). Spent only
/// by 0state proposal and vote.
pub const TREASURY_BPS_DIVISOR: u64 = 10;

/// The 0state governance program. The treasury can only be spent by executing a
/// passed spending proposal owned by this program.
pub const ZEROSTATE_PROGRAM: Pubkey = pubkey!("BPu5i6U3T69a16TY62J2HBWk7DJMHrU4UHH1Z1GCGmY9");

/// Anchor's 8-byte account discriminator for a 0state `Proposal`. Used to verify
/// a supplied account really is a proposal before decoding it by hand (state
/// avoids a code dependency on zerostate to keep the two programs decoupled).
pub const PROPOSAL_DISCRIMINATOR: [u8; 8] = [26, 94, 189, 187, 116, 136, 53, 33];

/// Unused tail on every Proof account. Rent on this is the cost of an extra
/// mining identity — the only defence against one fast machine farming many
/// wallets. Roughly 0.0157 SOL per registration at current rent rates.
pub const SYBIL_BOND: usize = 900;
