use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::{constants::*, error::DaoError, state::{Dao, Proposal}};

/// Put a question to the membership. Citizens only — the proposer must hold a
/// Citizen NFT (verified the same way a vote is).
#[derive(Accounts)]
pub struct Propose<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(mut, seeds = [DAO_SEED], bump = dao.bump)]
    pub dao: Account<'info, Dao>,

    /// The proposer's Citizen NFT mint.
    pub citizen_mint: Account<'info, Mint>,

    /// The proposer's token account, proving they hold the NFT.
    #[account(
        constraint = proposer_token.mint == citizen_mint.key() @ DaoError::NotYourNFT,
        constraint = proposer_token.owner == proposer.key() @ DaoError::NotYourNFT,
        constraint = proposer_token.amount == 1 @ DaoError::NotYourNFT,
    )]
    pub proposer_token: Account<'info, TokenAccount>,

    /// CHECK: the CitizenMarker PDA — proven genuine by seeds + owner. Never
    /// deserialized.
    #[account(
        seeds = [CITIZEN_SEED, citizen_mint.key().as_ref()],
        bump,
        seeds::program = CITIZEN_PROGRAM,
        owner = CITIZEN_PROGRAM @ DaoError::NotACitizen,
    )]
    pub marker: UncheckedAccount<'info>,

    #[account(
        init,
        payer = proposer,
        space = 8 + Proposal::INIT_SPACE,
        seeds = [PROPOSAL_SEED, dao.proposal_count.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Propose>,
    title: String,
    body_hash: [u8; 32],
    spend_recipient: Pubkey,
    spend_amount: u64,
) -> Result<()> {
    require!(title.len() <= MAX_TITLE_LEN, DaoError::TitleTooLong);

    let clock = Clock::get()?;
    let dao = &mut ctx.accounts.dao;
    let p = &mut ctx.accounts.proposal;
    p.bump = ctx.bumps.proposal;
    p.id = dao.proposal_count;
    p.proposer = ctx.accounts.proposer.key();
    p.title = title;
    p.body_hash = body_hash;
    p.created_ts = clock.unix_timestamp;
    p.closes_ts = clock.unix_timestamp + dao.voting_period;
    p.yes = 0;
    p.no = 0;
    p.abstain = 0;
    p.electorate_at_open = dao.member_count;
    p.spend_recipient = spend_recipient;
    p.spend_amount = spend_amount;

    dao.proposal_count += 1;
    Ok(())
}
