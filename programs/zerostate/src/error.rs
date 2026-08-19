use anchor_lang::prelude::*;

#[error_code]
pub enum DaoError {
    #[msg("that mint is not a genuine 0state Citizen NFT")]
    NotACitizen,
    #[msg("you do not hold this Citizen NFT")]
    NotYourNFT,
    #[msg("proposal title is too long")]
    TitleTooLong,
    #[msg("voting on this proposal has closed")]
    VotingClosed,
    #[msg("invalid vote choice")]
    BadChoice,
}
