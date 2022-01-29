use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
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

                let acct_args = PurchaseAccountAccountArgs { payer_acct };
                process_purchase_account(program_id, acct_args, &args)
            }
        }

        // TODO(will): Do i need to do something if nothing matches?
    }
}

fn process_purchase_account(
    program_id: &Pubkey,
    acct_args: PurchaseAccountAccountArgs,
    data_args: &PurchaseAccountDataArgs,
) -> ProgramResult {
    let PurchaseAccountAccountArgs { payer_acct } = acct_args;

    let clock = Clock::get();
    Ok(())
}
