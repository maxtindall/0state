use anchor_lang::prelude::*;

// PDA seeds
pub const CONFIG_SEED: &[u8] = b"config";
pub const TREASURY_SEED: &[u8] = b"treasury";
/// Per-NFT marker: proves a mint is a genuine 0state Citizen. Governance reads
/// this (owned by the citizen program) instead of doing Metaplex verification.
pub const CITIZEN_SEED: &[u8] = b"citizen";

/// The number of Citizen NFTs the vote-count PDA reserves in its title, etc.
pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 200;
