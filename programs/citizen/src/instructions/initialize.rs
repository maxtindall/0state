use anchor_lang::prelude::*;

use crate::{constants::*, error::CitizenError, state::Config};

/// Found the Citizen registry. Once. Sets the founding tier size, the mint price
/// (0 on devnet), and the metadata template for Citizen NFTs.
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    founding_threshold: u64,
    mint_price: u64,
    name_prefix: String,
    symbol: String,
    base_uri: String,
) -> Result<()> {
    require!(name_prefix.len() <= MAX_NAME_LEN, CitizenError::StringTooLong);
    require!(symbol.len() <= MAX_SYMBOL_LEN, CitizenError::StringTooLong);
    require!(base_uri.len() <= MAX_URI_LEN, CitizenError::StringTooLong);

    let (_, treasury_bump) = Pubkey::find_program_address(&[TREASURY_SEED], ctx.program_id);

    let cfg = &mut ctx.accounts.config;
    cfg.bump = ctx.bumps.config;
    cfg.treasury_bump = treasury_bump;
    cfg.authority = ctx.accounts.authority.key();
    cfg.citizen_count = 0;
    cfg.founding_threshold = founding_threshold;
    cfg.mint_price = mint_price;
    cfg.name_prefix = name_prefix;
    cfg.symbol = symbol;
    cfg.base_uri = base_uri;
    cfg.reserved = [0u8; 64];
    msg!("0state Citizen registry founded: founding {} · price {} lamports", founding_threshold, mint_price);
    Ok(())
}
