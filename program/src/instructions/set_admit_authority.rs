use anchor_lang::prelude::*;
use crate::{constants::*, error::DaoError, state::Dao};

/// Transfer the one unequal power — who may admit and remove — to a new key.
/// This is how the commune can, in time, hand the door from the founder to a
/// multisig or to a governance process, rather than the founder holding it
/// forever.
#[derive(Accounts)]
pub struct SetAdmitAuthority<'info> {
    pub admit_authority: Signer<'info>,

    #[account(mut, seeds = [DAO_SEED], bump = dao.bump, has_one = admit_authority @ DaoError::NotTheAuthority)]
    pub dao: Account<'info, Dao>,

    /// CHECK: the new authority; only its key is stored.
    pub new_authority: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<SetAdmitAuthority>) -> Result<()> {
    ctx.accounts.dao.admit_authority = ctx.accounts.new_authority.key();
    Ok(())
}
