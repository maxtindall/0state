use anchor_lang::prelude::*;
use crate::constants::MAX_TITLE_LEN;

/// The DAO's own record. One per deployment. Holds only the rules of the vote —
/// there is no treasury, no admin power over citizens, and no way to mint a
/// vote. The only mutable field is the running count of citizens and proposals.
#[account]
#[derive(InitSpace)]
pub struct Dao {
    pub bump: u8,
    /// Who founded the commune.
    pub founder: Pubkey,
    /// The one power that is not equal: who may admit and remove members. This
    /// is a TRUSTED-AUTHORITY model by design — a closed commune, not a
    /// trustless one. It starts as the founder and can be handed on (to a
    /// multisig, or eventually to the DAO itself) via `set_admit_authority`.
    /// Once inside, every member is equal; the authority governs only the door.
    pub admit_authority: Pubkey,
    pub genesis_ts: i64,
    pub voting_period: i64,
    pub citizen_count: u64,
    pub proposal_count: u64,
    /// Forward space for the master-shares layer (a biometric-NFT voting class)
    /// and any later config, so the singleton can grow without a migration.
    pub reserved: [u8; 128],
}

/// A citizen: a wallet that proved it mined. One per wallet, permanent. Carries
/// no weight field, because there is none to carry — every citizen is one vote.
/// The labour that admitted them is recorded as a matter of record, not as a
/// multiplier.
#[account]
#[derive(InitSpace)]
pub struct Citizen {
    pub bump: u8,
    pub wallet: Pubkey,
    /// Who opened the door. The member roll of a trusted commune.
    pub admitted_by: Pubkey,
    pub joined_ts: i64,
    /// Snapshot of the miner's accepted-proof count at the moment of joining.
    /// Kept for the public record; it grants no extra votes.
    pub proofs_at_join: u64,
    pub votes_cast: u64,
}

/// A question put to the citizens. The full text lives off-chain (IPFS, the
/// dapp, anywhere); the chain holds a short title and the hash that pins the
/// body, so the thing voted on cannot be altered after the fact.
#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub bump: u8,
    pub id: u64,
    pub proposer: Pubkey,
    #[max_len(MAX_TITLE_LEN)]
    pub title: String,
    /// keccak/sha of the full proposal body, so off-chain text is tamper-evident.
    pub body_hash: [u8; 32],
    pub created_ts: i64,
    pub closes_ts: i64,
    pub yes: u64,
    pub no: u64,
    pub abstain: u64,
}

/// One ballot per citizen per proposal. Its existence is what prevents a second
/// vote — the account can only be created once. It also leaves an auditable
/// trail of how each citizen voted.
#[account]
#[derive(InitSpace)]
pub struct Ballot {
    pub bump: u8,
    pub proposal: Pubkey,
    pub citizen: Pubkey,
    pub choice: u8, // 0 = no, 1 = yes, 2 = abstain
    pub cast_ts: i64,
}
