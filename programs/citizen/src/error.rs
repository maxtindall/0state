use anchor_lang::prelude::*;

#[error_code]
pub enum CitizenError {
    #[msg("only the registry authority may perform this act")]
    NotAuthority,
    #[msg("arithmetic overflow")]
    Overflow,
    #[msg("the string is longer than the on-chain limit")]
    StringTooLong,
    #[msg("the mint price was not paid")]
    PriceNotPaid,
}
