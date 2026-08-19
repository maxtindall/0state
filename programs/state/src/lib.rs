pub mod constants;
pub mod error;
pub mod instructions;
pub mod records;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use records::*;

declare_id!("2xvfGKpTHy5EA8RFJsKXu73nJVFPRH6YHxDAE5Rh6SVE");

/// STATE — the mined franchise of 0state. A proof-of-work token whose *purpose*
/// is citizenship: to hold STATE you must have MINED it, and mining is the sole
/// qualification for membership in the 0state commune. Minted from zero, no
/// pre-mint, no admin inflation — the program itself is the only issuer, and
/// there is no Doge, no owner, no privileged key: STATE is fully autonomous, as
/// a communist franchise must be. Uncapped: the reward decays across a
/// distribution phase and then holds at a fixed tail forever, so labour is
/// always rewarded and no one's stake can be inflated away. Difficulty retargets
/// toward a target pace. One frank in every ten mined is routed to the commons
/// treasury — the collective fund — spendable only by a passed 0state vote.
#[program]
pub mod state {
    use super::*;

    /// Genesis. Creates the mint (authority = this program's config PDA) and
    /// the global config. Callable once.
    pub fn initialize(ctx: Context<Initialize>, difficulty: u8, cooldown: i64) -> Result<()> {
        instructions::initialize::handler(ctx, difficulty, cooldown)
    }

    /// Register a miner (creates their Proof account and starting challenge).
    pub fn register(ctx: Context<Register>) -> Result<()> {
        instructions::register::handler(ctx)
    }

    /// Submit a proof-of-work nonce and mint the reward.
    pub fn mine(ctx: Context<Mine>, nonce: u64) -> Result<()> {
        instructions::mine::handler(ctx, nonce)
    }

    /// One-time: attach Metaplex token metadata (name/symbol/uri) to the mint so
    /// explorers show "state" instead of a generic SPL token. The program
    /// signs as its own mint authority (config PDA); gated to the upgrade
    /// authority so the identity can't be front-run. Created mutable, to be
    /// frozen at mainnet.
    pub fn create_metadata(ctx: Context<CreateMetadata>, name: String, symbol: String, uri: String) -> Result<()> {
        instructions::create_metadata::handler(ctx, name, symbol, uri)
    }

    /// Execute a treasury spend authorized by a passed 0state proposal. Moves
    /// the proposal's fixed amount to its fixed recipient, signed by the treasury
    /// PDA; permissionless but single-use per proposal.
    pub fn treasury_withdraw(ctx: Context<TreasuryWithdraw>) -> Result<()> {
        instructions::treasury_withdraw::handler(ctx)
    }
}
