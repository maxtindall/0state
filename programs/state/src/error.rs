use anchor_lang::prelude::*;

#[error_code]
pub enum StateError {
    #[msg("state emission error")]
    FullyMined, // retained for stable error indices; state is now uncapped
    #[msg("proof does not meet the required difficulty")]
    InsufficientDifficulty,
    #[msg("cooldown has not elapsed since your last claim")]
    Cooldown,
    #[msg("arithmetic overflow")]
    Overflow,
    #[msg("only the program's upgrade authority may set token metadata")]
    NotUpgradeAuthority,
    #[msg("that account is not a 0state proposal")]
    NotAZerostateProposal,
    #[msg("this proposal is not a spending proposal")]
    NotASpendProposal,
    #[msg("the proposal has not passed (still open, or more no than yes)")]
    ProposalNotPassed,
    #[msg("the recipient does not match the proposal")]
    RecipientMismatch,
    #[msg("the treasury does not hold enough for this withdrawal")]
    InsufficientTreasury,
    #[msg("the config account is already migrated to the current layout")]
    AlreadyMigrated,
}
