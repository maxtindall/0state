pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("FVB77ftzfggbdk5tHHB6fE4AzHQrHMjmzXjn8UujypfM");

/// 0state Citizens — CityDAO-style citizenship, on Solana.
///
/// Citizenship is a **transferable NFT**: mint one (anyone may), hold it, trade
/// it on any marketplace — and holding it is your membership and your vote in
/// 0state. Each Citizen NFT is a true 1-of-1 (supply locked at mint), and each
/// carries a `CitizenMarker` PDA so 0state's voting program can verify it is
/// genuine. Mint proceeds fund the commons treasury.
///
/// This program mints and records citizens; it does not vote. Governance lives in
/// the `zerostate` program, which reads Citizen NFT ownership (one NFT, one vote).
#[program]
pub mod citizen {
    use super::*;

    /// Found the Citizen registry. Once.
    pub fn initialize(
        ctx: Context<Initialize>,
        founding_threshold: u64,
        mint_price: u64,
        name_prefix: String,
        symbol: String,
        base_uri: String,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, founding_threshold, mint_price, name_prefix, symbol, base_uri)
    }

    /// Mint a transferable Citizen NFT to the caller (supply locked at 1).
    pub fn mint_citizen(ctx: Context<MintCitizen>) -> Result<()> {
        instructions::mint_citizen::handler(ctx)
    }
}
