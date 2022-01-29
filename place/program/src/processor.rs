use solana_program::{
    account_info::{Account, AccountInfo},
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

use crate::instruction::{PlaceInstruction, PurchaseAccountAccountArgs, PurchaseAccountDataArgs};
use borsh::{BorshDeserialize, BorshSerialize};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = PlaceInstruction::try_from_slice(instruction_data)?;

        match instruction {
            PlaceInstruction::PurchaseAccount(args) => {
                let acct_info_iter = &mut accounts.iter();
                let payer_acct = next_account_info(acct_info_iter)?;

                let account_args = PurchaseAccountAccountArgs { payer_acct };
                process_purchase_account()
            }
        }
    }
}

fn process_purchase_account(
    program_id: &Pubkey,
    acct_args: PurchaseAccountAccountArgs,
    data_args: &PurchaseAccountDataArgs,
) -> ProgramResult {
    let PurchaseAccountAccountArgs { payer_acct } = acct_args;

    Ok(())
}
