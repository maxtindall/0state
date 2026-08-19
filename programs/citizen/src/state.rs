use anchor_lang::prelude::*;
use crate::constants::*;

/// The Citizen registry. One per deployment. It records how many citizens have
/// been minted, who the first `founding_threshold` are (a tier), and the price
/// (in lamports) of a Citizen NFT — 0 on devnet. Mint proceeds go to the
/// program-controlled treasury, spent only by a passed 0state vote.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub bump: u8,
    pub treasury_bump: u8,
    /// Who founded the registry (can update price / metadata template). Grants no
    /// vote — governance is one Citizen NFT, one vote, held by NFT owners.
    pub authority: Pubkey,
    pub citizen_count: u64,
    /// The first this-many citizens are "Founding Citizens".
    pub founding_threshold: u64,
    /// Price of a Citizen NFT in lamports. 0 = free (devnet).
    pub mint_price: u64,
    #[max_len(MAX_NAME_LEN)]
    pub name_prefix: String, // e.g. "0state Citizen"
    #[max_len(MAX_SYMBOL_LEN)]
    pub symbol: String,      // e.g. "0CIT"
    #[max_len(MAX_URI_LEN)]
    pub base_uri: String,    // metadata JSON URI (shared; art can be per-id off-chain)
    pub reserved: [u8; 64],
}

/// A marker proving a given mint is a genuine 0state Citizen NFT. Created by the
/// citizen program at mint time and never by anyone else, so 0state's voting
/// program can verify citizenship by checking this PDA exists and is owned by the
/// citizen program — no Metaplex read required. The NFT itself is a normal,
/// freely transferable SPL token (supply 1); this marker travels with the *mint*,
/// not the holder, so whoever holds the NFT at vote time is the citizen.
#[account]
#[derive(InitSpace)]
pub struct CitizenMarker {
    pub bump: u8,
    pub mint: Pubkey,
    pub index: u64,
    pub founding: bool,
    /// The wallet the NFT was first minted to (record only; the NFT is tradeable).
    pub minted_to: Pubkey,
    pub minted_ts: i64,
}
