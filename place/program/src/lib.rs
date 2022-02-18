pub mod config;
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;
pub mod utils;

#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;

// Declare the program ID

use std::str::FromStr;

pub fn id() -> solana_program::pubkey::Pubkey {
    // NOTE(will): for some reason cargo test doesn't pick up the value set by config.toml
    return solana_program::pubkey::Pubkey::from_str(
        std::option_env!("SOLANA_PLACE_PROGRAM_ID")
            .unwrap_or("tapestry11111111111111111111111111111111111"),
    )
    .unwrap();
}
