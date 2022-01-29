use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::account_info::{Account, AccountInfo};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum PlaceInstruction {
    PurchaseAccount(PurchaseAccountDataArgs),
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PurchaseAccountDataArgs {
    // any?
}


pub struct PuchaseAccountAccountArgs<'a, 'b: 'a> {
    /// `[signer]` Account that will own this... account... fuck
    pub payer_acct: &'a AccountInfo<'b>,
}
