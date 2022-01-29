use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

/// PDA prefix for user accounts
pub const USER_ACCOUNT_PDA_PREFIX: &str = "acct";

#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone)]
pub struct UserAccount {
    pub owner: Pubkey,

    pub last_update: u64,
}
