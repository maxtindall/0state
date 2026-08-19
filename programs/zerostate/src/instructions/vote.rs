use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::{constants::*, error::DaoError, state::{Proposal, Ballot}};

/// Cast one vote with a Citizen NFT. Citizenship is holding the NFT: the vote
/// verifies (1) the voter holds exactly one of `citizen_mint`, and (2) that mint
/// is a genuine Citizen — its `CitizenMarker` PDA exists and is owned by the
/// citizen program. One NFT, one vote. The ballot is keyed by the mint, so each
/// NFT votes at most once and a holder of several NFTs may cast several votes.
#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,

    /// The Citizen NFT's mint.
    pub citizen_mint: Account<'info, Mint>,

    /// The voter's token account proving they hold the NFT right now.
    #[account(
        constraint = voter_token.mint == citizen_mint.key() @ DaoError::NotYourNFT,
        constraint = voter_token.owner == voter.key() @ DaoError::NotYourNFT,
        constraint = voter_token.amount == 1 @ DaoError::NotYourNFT,
    )]
    pub voter_token: Account<'info, TokenAccount>,

    /// CHECK: the CitizenMarker PDA. Proven genuine by the seeds (derived under
    /// the citizen program) AND the owner check (actually owned by it, i.e. it
    /// exists because the citizen program minted this NFT). Never deserialized.
    #[account(
        seeds = [CITIZEN_SEED, citizen_mint.key().as_ref()],
        bump,
        seeds::program = CITIZEN_PROGRAM,
        owner = CITIZEN_PROGRAM @ DaoError::NotACitizen,
    )]
    pub marker: UncheckedAccount<'info>,

    #[account(mut, seeds = [PROPOSAL_SEED, proposal.id.to_le_bytes().as_ref()], bump = proposal.bump)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        init,
        payer = voter,
        space = 8 + Ballot::INIT_SPACE,
        seeds = [BALLOT_SEED, proposal.key().as_ref(), citizen_mint.key().as_ref()],
        bump
    )]
    pub ballot: Account<'info, Ballot>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Vote>, choice: u8) -> Result<()> {
    require!(choice <= 2, DaoError::BadChoice);

    let clock = Clock::get()?;
    let p = &mut ctx.accounts.proposal;
    require!(clock.unix_timestamp < p.closes_ts, DaoError::VotingClosed);

    // One NFT, one vote.
    match choice {
        1 => p.yes += 1,
        0 => p.no += 1,
        _ => p.abstain += 1,
    }

    let ballot = &mut ctx.accounts.ballot;
    ballot.bump = ctx.bumps.ballot;
    ballot.proposal = p.key();
    ballot.citizen_mint = ctx.accounts.citizen_mint.key();
    ballot.voter = ctx.accounts.voter.key();
    ballot.choice = choice;
    ballot.weight = 1;
    ballot.cast_ts = clock.unix_timestamp;
    Ok(())
}
