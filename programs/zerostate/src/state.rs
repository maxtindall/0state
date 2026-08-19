use anchor_lang::prelude::*;
use crate::constants::MAX_TITLE_LEN;

/// The organization's record. One per deployment. Holds only the rules of the
/// vote — no treasury, no admin power, no way to mint a vote.
#[account]
#[derive(InitSpace)]
pub struct Dao {
    pub bump: u8,
    /// Who founded it (recorded; grants no special power).
    pub founder: Pubkey,
    pub genesis_ts: i64,
    pub voting_period: i64,
    pub member_count: u64, // reserved; the live count is the citizen program's citizen_count
    pub proposal_count: u64,
    /// Forward space so the singleton can grow without a migration.
    pub reserved: [u8; 64],
}

/// A question put to the membership. Full text lives off-chain; the chain keeps
/// a title and the hash that pins it. Tallies are counts of Citizen NFTs.
///
/// NOTE: the field layout is unchanged from the mined-franchise era so the
/// `state` program's `treasury_withdraw` (which decodes this account by hand and
/// checks the discriminator) keeps working: a passed spending proposal still
/// authorizes moving STATE from the commons treasury to a recipient.
#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub bump: u8,
    pub id: u64,
    pub proposer: Pubkey,
    #[max_len(MAX_TITLE_LEN)]
    pub title: String,
    pub body_hash: [u8; 32],
    pub created_ts: i64,
    pub closes_ts: i64,
    pub yes: u64,
    pub no: u64,
    pub abstain: u64,
    /// Citizen count at the moment this opened — a stable turnout denominator.
    pub electorate_at_open: u64,
    /// If this is a spending proposal, the recipient of the treasury STATE and
    /// the amount (base units). A default (zero) recipient with amount 0 marks an
    /// ordinary proposal that moves no funds. When such a proposal passes, anyone
    /// may execute the STATE `treasury_withdraw` it authorizes.
    pub spend_recipient: Pubkey,
    pub spend_amount: u64,
}

/// One ballot per **Citizen NFT** per proposal. Its existence prevents the same
/// NFT from voting twice; it records which NFT voted and how, for a full audit
/// trail. Because the NFT is transferable, the ballot is keyed by the mint, not
/// the wallet — a whale holding several NFTs casts one vote per NFT.
#[account]
#[derive(InitSpace)]
pub struct Ballot {
    pub bump: u8,
    pub proposal: Pubkey,
    pub citizen_mint: Pubkey,
    pub voter: Pubkey, // who held the NFT when it voted (record only)
    pub choice: u8,    // 0 = no, 1 = yes, 2 = abstain
    pub weight: u64,   // always 1 — one NFT, one vote
    pub cast_ts: i64,
}
