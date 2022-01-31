use solana_program::{
    account_info::{next_account_info, AccountInfo},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
};

use crate::instruction::{
    PlaceInstruction, PurchaseAccountAccountArgs, PurchaseAccountDataArgs, SetPixelAccountArgs,
    SetPixelDataArgs,
};

use crate::error::PlaceError::{IncorrectPatchPDA, InvalidInstruction};

use crate::state::{
    find_address_for_patch, Patch, PATCH_DATA_LEN, PATCH_PDA_PREFIX, PATCH_SIZE_PX,
};

use borsh::{BorshDeserialize, BorshSerialize};

use crate::utils::create_or_allocate_account_raw;

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
            PlaceInstruction::SetPixel(args) => {
                let acct_info_iter = &mut accounts.iter();
                let payer_acct = next_account_info(acct_info_iter)?;
                let patch_pda_acct = next_account_info(acct_info_iter)?;
                let system_acct = next_account_info(acct_info_iter)?;

                let acct_args = SetPixelAccountArgs {
                    payer_acct,
                    patch_pda_acct,
                    system_acct,
                };

                process_set_pixel(program_id, acct_args, &args)
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

    // Make sure account hasn't already been initialized?
    // allocate account
    // set last_used to zero
    // serialize account

    let clock = Clock::get();
    Ok(())
}

fn process_set_pixel(
    program_id: &Pubkey,
    acct_args: SetPixelAccountArgs,
    data_args: &SetPixelDataArgs,
) -> ProgramResult {
    let SetPixelAccountArgs {
        payer_acct,
        patch_pda_acct,
        system_acct,
    } = acct_args;

    let SetPixelDataArgs {
        x,
        y,
        x_offset,
        y_offset,
        pixel,
    } = data_args;

    let (patch_pda_key, patch_pda_bump) = find_address_for_patch(*x, *y, program_id);

    if patch_pda_key != *patch_pda_acct.key {
        return Err(IncorrectPatchPDA.into());
    }

    let mut did_allocate = false;

    if patch_pda_acct.data_is_empty() {
        // Allocate space for the tapestry state in the PDA account, subtracting the necessary rent from the payer
        create_or_allocate_account_raw(
            *program_id,
            patch_pda_acct,
            system_acct,
            payer_acct,
            PATCH_DATA_LEN,
            &[
                PATCH_PDA_PREFIX.as_bytes(),
                &x.to_le_bytes(),
                &y.to_le_bytes(),
                &[patch_pda_bump],
            ],
        )?;

        did_allocate = true;
    }

    let mut patch: Patch = try_from_slice_unchecked(&patch_pda_acct.try_borrow_data()?)?;

    let patch_size = PATCH_SIZE_PX as u8;
    if did_allocate {
        patch.x = *x;
        patch.y = *y;
        patch.pixels = vec![0; PATCH_SIZE_PX * PATCH_SIZE_PX];
    }

    let y_offset_usize = *y_offset as usize;
    let x_offset_usize = *x_offset as usize;

    let idx = (y_offset_usize * PATCH_SIZE_PX) + x_offset_usize;
    patch.pixels[idx] = *pixel;
    patch.serialize(&mut *patch_pda_acct.data.borrow_mut())?;

    Ok(())
}
