use solana_program::{
    account_info::{next_account_info, AccountInfo},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    sysvar::{clock::Clock, Sysvar},
};

use crate::instruction::{
    InitPatchAccountArgs, InitPatchDataArgs, PlaceInstruction, PurchaseGameplayTokenAccountArgs,
    PurchaseGameplayTokenDataArgs, SetPixelAccountArgs, SetPixelDataArgs,
    UpdatePlaceStateAccountArgs, UpdatePlaceStateDataArgs,
};

use crate::error::PlaceError;
use crate::error::PlaceError::{
    IncorrectPatchPDA, InvalidPatchCoordinates, PatchAccountAlreadyInitialized,
};

use crate::state::{
    find_address_for_patch, Patch, PlaceAccountType, PlaceState, PATCH_DATA_LEN, PATCH_PDA_PREFIX,
    PATCH_SIZE_PX, PLACE_HEIGHT_PX, PLACE_WIDTH_PX,
};

use borsh::{BorshDeserialize, BorshSerialize};

use crate::utils::{assert_signer, create_or_allocate_account_raw};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = PlaceInstruction::try_from_slice(instruction_data)?;

        match instruction {
            PlaceInstruction::UpdatePlaceState(args) => {
                let acct_info_iter = &mut accounts.iter();
                let current_owner_acct = next_account_info(acct_info_iter)?;
                let place_state_pda_acct = next_account_info(acct_info_iter)?;
                let system_acct = next_account_info(acct_info_iter)?;

                let acct_args = UpdatePlaceStateAccountArgs {
                    current_owner_acct,
                    place_state_pda_acct,
                    system_acct,
                };

                process_update_place_state(program_id, acct_args, args)
            }
            PlaceInstruction::InitPatch(args) => {
                let acct_info_iter = &mut accounts.iter();
                let payer_acct = next_account_info(acct_info_iter)?;
                let patch_pda_acct = next_account_info(acct_info_iter)?;
                let system_acct = next_account_info(acct_info_iter)?;

                let acct_args = InitPatchAccountArgs {
                    payer_acct,
                    patch_pda_acct,
                    system_acct,
                };

                process_init_patch(program_id, acct_args, &args)
            }
            PlaceInstruction::PurchaseGameplayToken(args) => {
                let acct_info_iter = &mut accounts.iter();
                let payer_acct = next_account_info(acct_info_iter)?;
                let gameplay_meta_pda_acct = next_account_info(acct_info_iter)?;
                let system_acct = next_account_info(acct_info_iter)?;

                let acct_args = PurchaseGameplayTokenAccountArgs {
                    payer_acct,
                    gameplay_meta_pda_acct,
                    system_acct,
                };

                process_purchase_gameplay_token(program_id, acct_args, &args)
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
    }
}

fn process_update_place_state(
    program_id: &Pubkey,
    acct_args: UpdatePlaceStateAccountArgs,
    data_args: UpdatePlaceStateDataArgs,
) -> ProgramResult {
    let UpdatePlaceStateDataArgs {
        new_owner,
        is_frozen,
        paintbrush_price,
        paintbrush_cooldown,
        bomb_price,
    } = data_args;

    let UpdatePlaceStateAccountArgs {
        current_owner_acct,
        place_state_pda_acct,
        system_acct,
    } = acct_args;

    let (place_state_pda, _) = PlaceState::pda();
    if place_state_pda != *place_state_pda_acct.key {
        return Err(PlaceError::IncorrectPlaceStatePDA.into());
    }

    if *system_acct.key != solana_program::system_program::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

    assert_signer(&current_owner_acct)?;

    if place_state_pda_acct.data_is_empty() {
        // TODO(will): consider just putting owner pubkey as static consant
        // rather than relying on being first to call this instruction

        create_or_allocate_account_raw(
            *program_id,
            place_state_pda_acct,
            system_acct,
            current_owner_acct,
            PlaceState::LEN,
            &[PlaceState::PREFIX.as_bytes()],
        )?;

        let mut state: PlaceState =
            try_from_slice_unchecked(&place_state_pda_acct.data.borrow_mut())?;
        state.acct_type = PlaceAccountType::PlaceState;
        state.owner = *current_owner_acct.key;
        state.is_frozen = is_frozen.unwrap_or(crate::state::DEFAULT_IS_FROZEN);
        state.paintbrush_price = paintbrush_price.unwrap_or(crate::state::DEFAULT_PAINTBRUSH_PRICE);
        state.paintbrush_cooldown =
            paintbrush_cooldown.unwrap_or(crate::state::DEFAULT_PAINTBRUSH_COOLDOWN);
        state.bomb_price = paintbrush_cooldown.unwrap_or(crate::state::DEFAULT_BOMB_PRICE);

        state.serialize(&mut *place_state_pda_acct.data.borrow_mut())?;

        Ok(())
    } else {
        let mut state = PlaceState::from_account_info(place_state_pda_acct)?;

        // Only owner can update state
        if state.owner != *current_owner_acct.key {
            return Err(PlaceError::InvalidOwner.into());
        }

        if let Some(new_owner) = new_owner {
            state.owner = new_owner;
        }
        if let Some(is_frozen) = is_frozen {
            state.is_frozen = is_frozen;
        }
        if let Some(paintbrush_price) = paintbrush_price {
            state.paintbrush_price = paintbrush_price;
        }
        if let Some(paintbrush_cooldown) = paintbrush_cooldown {
            state.paintbrush_cooldown = paintbrush_cooldown;
        }
        if let Some(bomb_price) = bomb_price {
            state.bomb_price = bomb_price;
        }

        state.serialize(&mut *place_state_pda_acct.data.borrow_mut())?;
        Ok(())
    }
}

fn process_init_patch(
    program_id: &Pubkey,
    acct_args: InitPatchAccountArgs,
    data_args: &InitPatchDataArgs,
) -> ProgramResult {
    let InitPatchAccountArgs {
        payer_acct,
        patch_pda_acct,
        system_acct,
    } = acct_args;

    let InitPatchDataArgs { x_patch, y_patch } = data_args;

    let max_x_patch = (PLACE_WIDTH_PX as usize) / PATCH_SIZE_PX;
    let max_y_patch = (PLACE_HEIGHT_PX as usize) / PATCH_SIZE_PX;
    let invalid_x = (*x_patch as usize) > max_x_patch;
    let invalid_y = (*y_patch as usize) > max_y_patch;

    if invalid_x || invalid_y {
        return Err(InvalidPatchCoordinates.into());
    }

    let (patch_pda_key, patch_pda_bump) = find_address_for_patch(*x_patch, *y_patch, program_id);

    if patch_pda_key != *patch_pda_acct.key {
        return Err(IncorrectPatchPDA.into());
    }

    if !patch_pda_acct.data_is_empty() {
        return Err(PatchAccountAlreadyInitialized.into());
    }

    // Allocate space for the tapestry state in the PDA account, subtracting the necessary rent from the payer
    create_or_allocate_account_raw(
        *program_id,
        patch_pda_acct,
        system_acct,
        payer_acct,
        PATCH_DATA_LEN,
        &[
            PATCH_PDA_PREFIX.as_bytes(),
            &x_patch.to_le_bytes(),
            &y_patch.to_le_bytes(),
            &[patch_pda_bump],
        ],
    )?;

    let mut patch: Patch = try_from_slice_unchecked(&patch_pda_acct.try_borrow_data()?)?;

    patch.acct_type = PlaceAccountType::Patch;
    patch.x = *x_patch;
    patch.y = *y_patch;
    patch.pixels = vec![0; PATCH_SIZE_PX * PATCH_SIZE_PX];

    patch.serialize(&mut *patch_pda_acct.data.borrow_mut())?;

    return Ok(());
}

fn process_purchase_gameplay_token(
    program_id: &Pubkey,
    acct_args: PurchaseGameplayTokenAccountArgs,
    data_args: &PurchaseGameplayTokenDataArgs,
) -> ProgramResult {
    let PurchaseGameplayTokenAccountArgs {
        payer_acct,
        gameplay_meta_pda_acct,
        system_acct,
    } = acct_args;

    // what are the PDA seeds for the gameplay token account

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

    // TODO(will): check data not empty? or just let if fail?

    // TODO(will): IMPORTANT - setup utils function for parsing the different account types
    // but checking that the first byte matches the `AccountType` enum that we are expecting.

    // This could be sped up by just computing the offset and setting directly.
    let mut patch: Patch = try_from_slice_unchecked(&patch_pda_acct.try_borrow_data()?)?;

    let y_offset_usize = *y_offset as usize;
    let x_offset_usize = *x_offset as usize;

    let idx = (y_offset_usize * PATCH_SIZE_PX) + x_offset_usize;
    patch.pixels[idx] = *pixel;
    patch.serialize(&mut *patch_pda_acct.data.borrow_mut())?;

    Ok(())
}
