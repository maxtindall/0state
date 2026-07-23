pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("CcEbfypSNbA1YKPsW7PVLRQzzEnKKMcPXBL7CxDW9Joz");

/// 0state DAO — communist, proof-of-mine governance.
///
/// A closed commune. Members are admitted by a trusted authority and must
/// have mined frankcoin to be eligible. Once inside: one member, one vote. The
/// franchise reads the Proof account, never a token balance, so a vote is earned
/// by labour and admission, not bought. Every citizen is equal and proposing is
/// an equal right; only the door (admit / remove) is an unequal, trusted power.
///
/// This program is the VOTING layer only. It holds no funds and custodies
/// nothing. Any real assets a 0state entity controls must live behind a
/// separate multisig / legal wrapper that treats these votes as its mandate —
/// never inside this program.
#[program]
pub mod zerostate {
    use super::*;

    /// Found the DAO. Once.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Admit a member. Trusted-authority act; mining is the floor.
    pub fn admit(ctx: Context<Admit>) -> Result<()> {
        instructions::admit::handler(ctx)
    }

    /// Remove a member. Trust withdrawn.
    pub fn revoke(ctx: Context<Revoke>) -> Result<()> {
        instructions::revoke::handler(ctx)
    }

    /// Hand the door to a new authority (a multisig, or the DAO itself).
    pub fn set_admit_authority(ctx: Context<SetAdmitAuthority>) -> Result<()> {
        instructions::set_admit_authority::handler(ctx)
    }

    /// Put a question to the citizens.
    pub fn propose(ctx: Context<Propose>, title: String, body_hash: [u8; 32]) -> Result<()> {
        instructions::propose::handler(ctx, title, body_hash)
    }

    /// Cast one vote: 0 no, 1 yes, 2 abstain.
    pub fn vote(ctx: Context<Vote>, choice: u8) -> Result<()> {
        instructions::vote::handler(ctx, choice)
    }
}
