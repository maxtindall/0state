use anchor_lang::prelude::*;

/// The citizen program. Membership and the vote are proven by holding a Citizen
/// NFT — a transferable SPL token whose mint carries a `CitizenMarker` PDA owned
/// by this program. One NFT, one vote.
pub const CITIZEN_PROGRAM: Pubkey = pubkey!("FVB77ftzfggbdk5tHHB6fE4AzHQrHMjmzXjn8UujypfM");

// PDA seeds
pub const DAO_SEED: &[u8] = b"dao";
pub const PROPOSAL_SEED: &[u8] = b"proposal";
pub const BALLOT_SEED: &[u8] = b"ballot";
/// The citizen program's per-NFT marker seed. 0state derives the same PDA under
/// CITIZEN_PROGRAM to *prove* a mint is a genuine Citizen NFT — it never writes
/// one. The marker exists iff the citizen program minted the NFT.
pub const CITIZEN_SEED: &[u8] = b"citizen";

/// A proposal is open for this long.
pub const DEFAULT_VOTING_PERIOD: i64 = 3 * 24 * 60 * 60; // three days

/// Max on-chain title length; the body lives off-chain, pinned by its hash.
pub const MAX_TITLE_LEN: usize = 96;
