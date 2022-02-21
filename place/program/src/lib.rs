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
    return solana_program::pubkey::Pubkey::from_str(std::env!("SOLANA_PLACE_PROGRAM_ID")).unwrap();
}

pub fn build_hacks_do_not_call() {
    // this seems to be the only way I can force a rebuild if this env variable changes
    println!("cargo:rerun-if-env-changed=SOLANA_PLACE_PROGRAM_ID");
}
