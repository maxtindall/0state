use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount};
use anchor_spl::token::spl_token::instruction::AuthorityType;
use anchor_spl::metadata::{
    create_metadata_accounts_v3, mpl_token_metadata::types::DataV2,
    CreateMetadataAccountsV3, Metadata,
};

use crate::{constants::*, error::CitizenError, state::{Config, CitizenMarker}};

/// Mint a Citizen NFT to the caller — the CityDAO move. Anyone may become a
/// citizen by minting; the NFT is a normal, freely transferable SPL token
/// (supply locked at 1), and *holding it* is citizenship and the vote. Mint
/// proceeds (0 on devnet) go to the commons treasury.
///
/// The client generates a fresh mint keypair and passes it; the program creates
/// the mint (authority = config PDA), mints exactly 1, attaches Metaplex
/// metadata, then renounces the mint authority so supply can never exceed 1 —
/// a true 1-of-1. A `CitizenMarker` PDA is created so 0state can verify the NFT
/// is genuine without a Metaplex read.
#[derive(Accounts)]
pub struct MintCitizen<'info> {
    #[account(mut)]
    pub minter: Signer<'info>,

    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = minter,
        mint::decimals = 0,
        mint::authority = config,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = minter,
        associated_token::mint = mint,
        associated_token::authority = minter
    )]
    pub minter_ata: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = minter,
        space = 8 + CitizenMarker::INIT_SPACE,
        seeds = [CITIZEN_SEED, mint.key().as_ref()],
        bump
    )]
    pub marker: Account<'info, CitizenMarker>,

    /// CHECK: the Metaplex metadata PDA for this mint; written by the token
    /// metadata program, which enforces the address.
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: the commons treasury PDA (no private key). Receives the mint price;
    /// spent only by a passed 0state vote. Seeds enforce the address.
    #[account(mut, seeds = [TREASURY_SEED], bump = config.treasury_bump)]
    pub treasury: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<MintCitizen>) -> Result<()> {
    let index = ctx.accounts.config.citizen_count;
    let price = ctx.accounts.config.mint_price;
    let founding_threshold = ctx.accounts.config.founding_threshold;
    let bump = ctx.accounts.config.bump;

    // 1. Pay the mint price (if any) into the commons treasury.
    if price > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                system_program::Transfer {
                    from: ctx.accounts.minter.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            price,
        )?;
    }

    let signer: &[&[&[u8]]] = &[&[CONFIG_SEED, &[bump]]];

    // 2. Mint exactly one token to the citizen.
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.minter_ata.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer,
        ),
        1,
    )?;

    // 3. Attach Metaplex metadata (name/symbol/uri) while the config PDA is still
    //    the mint authority.
    let name = format!("{} #{}", ctx.accounts.config.name_prefix, index);
    let data = DataV2 {
        name,
        symbol: ctx.accounts.config.symbol.clone(),
        uri: ctx.accounts.config.base_uri.clone(),
        seller_fee_basis_points: 0,
        creators: None,
        collection: None,
        uses: None,
    };
    create_metadata_accounts_v3(
        CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.key(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: ctx.accounts.config.to_account_info(),
                update_authority: ctx.accounts.config.to_account_info(),
                payer: ctx.accounts.minter.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer,
        ),
        data,
        true,  // is_mutable
        true,  // update_authority_is_signer (config signs via seeds)
        None,
    )?;

    // 4. Renounce the mint authority — supply is now locked at 1 forever.
    token::set_authority(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            SetAuthority {
                current_authority: ctx.accounts.config.to_account_info(),
                account_or_mint: ctx.accounts.mint.to_account_info(),
            },
            signer,
        ),
        AuthorityType::MintTokens,
        None,
    )?;

    // 5. Drop the citizenship marker and count the citizen.
    let founding = index < founding_threshold;
    let marker = &mut ctx.accounts.marker;
    marker.bump = ctx.bumps.marker;
    marker.mint = ctx.accounts.mint.key();
    marker.index = index;
    marker.founding = founding;
    marker.minted_to = ctx.accounts.minter.key();
    marker.minted_ts = Clock::get()?.unix_timestamp;

    let cfg = &mut ctx.accounts.config;
    cfg.citizen_count = cfg.citizen_count.checked_add(1).ok_or(CitizenError::Overflow)?;

    msg!("0state Citizen #{} minted to {}{}", index, ctx.accounts.minter.key(),
        if founding { " (Founding Citizen)" } else { "" });
    Ok(())
}
