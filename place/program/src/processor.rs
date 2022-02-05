use solana_program::{
    account_info::{next_account_info, AccountInfo},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
    pubkey::Pubkey,
    system_instruction,
    sysvar::{clock::Clock, rent::Rent, Sysvar},
};

use crate::{
    id,
    instruction::{
        InitPatchAccountArgs, InitPatchDataArgs, PlaceInstruction,
        PurchaseGameplayTokenAccountArgs, PurchaseGameplayTokenDataArgs, SetPixelAccountArgs,
        SetPixelDataArgs, UpdatePlaceStateAccountArgs, UpdatePlaceStateDataArgs,
    },
};

use spl_token::{
    instruction::initialize_mint,
    state::{Account as TokenAccount, Mint},
};

use spl_associated_token_account::{create_associated_token_account, get_associated_token_address};

use crate::error::PlaceError;
use crate::error::PlaceError::{
    IncorrectPatchPDA, InvalidPatchCoordinates, PatchAccountAlreadyInitialized,
};

use crate::state::{
    find_address_for_patch, GameplayTokenMeta, GameplayTokenType, Patch, PlaceAccountType,
    PlaceState, PATCH_DATA_LEN, PATCH_PDA_PREFIX, PATCH_SIZE_PX, PLACE_HEIGHT_PX, PLACE_WIDTH_PX,
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
                let place_state_pda_acct = next_account_info(acct_info_iter)?;
                let gameplay_meta_pda_acct = next_account_info(acct_info_iter)?;
                let gameplay_token_mint_pda_acct = next_account_info(acct_info_iter)?;
                let gameplay_token_ata_acct = next_account_info(acct_info_iter)?;
                let token_prog_acct = next_account_info(acct_info_iter)?;
                let ata_prog_acct = next_account_info(acct_info_iter)?;
                let system_prog_acct = next_account_info(acct_info_iter)?;
                let rent_sysvar_acct = next_account_info(acct_info_iter)?;

                let acct_args = PurchaseGameplayTokenAccountArgs {
                    payer_acct,
                    place_state_pda_acct,
                    gameplay_meta_pda_acct,
                    gameplay_token_mint_pda_acct,
                    gameplay_token_ata_acct,
                    token_prog_acct,
                    ata_prog_acct,
                    system_prog_acct,
                    rent_sysvar_acct,
                };

                process_purchase_gameplay_token(program_id, acct_args, args)
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

    let (place_state_pda, place_state_pda_bump) = PlaceState::pda();
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
            &[PlaceState::PREFIX.as_bytes(), &[place_state_pda_bump]],
        )?;

        let mut state: PlaceState =
            try_from_slice_unchecked(&place_state_pda_acct.data.borrow_mut())?;
        state.acct_type = PlaceAccountType::PlaceState;
        state.owner = new_owner.unwrap_or(*current_owner_acct.key);
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

    // TODO(will): check owner, validate inputs more

    if *system_acct.key != solana_program::system_program::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

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
    data_args: PurchaseGameplayTokenDataArgs,
) -> ProgramResult {
    let PurchaseGameplayTokenAccountArgs {
        payer_acct,
        place_state_pda_acct,
        gameplay_meta_pda_acct,
        gameplay_token_mint_pda_acct,
        gameplay_token_ata_acct,
        token_prog_acct,
        ata_prog_acct,
        system_prog_acct,
        rent_sysvar_acct,
    } = acct_args;

    let PurchaseGameplayTokenDataArgs {
        token_type,
        random_seed,
        desired_price,
    } = data_args;

    assert_signer(payer_acct)?;

    let (gameplay_meta_pda, gameplay_meta_pda_bump) = GameplayTokenMeta::pda(random_seed);
    if gameplay_meta_pda != *gameplay_meta_pda_acct.key {
        return Err(PlaceError::IncorrectGameplayTokenMetaPDA.into());
    }

    let (place_state_pda, place_state_pda_bump) = PlaceState::pda();
    if place_state_pda != *place_state_pda_acct.key {
        return Err(PlaceError::IncorrectPlaceStatePDA.into());
    }

    let (gameplay_token_mint_pda, gameplay_token_mint_pda_bump) =
        GameplayTokenMeta::token_mint_pda(random_seed);
    if gameplay_token_mint_pda != *gameplay_token_mint_pda_acct.key {
        return Err(PlaceError::InvalidGameplayTokenMintPDA.into());
    }

    if *system_prog_acct.key != solana_program::system_program::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

    if *token_prog_acct.key != spl_token::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

    if *ata_prog_acct.key != spl_associated_token_account::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

    // TODO(will): how do I check the rent sysvar account is correct? do I need to?

    if !gameplay_meta_pda_acct.data_is_empty() {
        return Err(PlaceError::GameplayTokenAlreadyPurchased.into());
    }

    let state = PlaceState::from_account_info(place_state_pda_acct)?;
    let price: u64 = match token_type {
        GameplayTokenType::PaintBrush => state.paintbrush_price,
        GameplayTokenType::Bomb => state.bomb_price,
    };

    if price != desired_price {
        return Err(PlaceError::DesiredPriceDifferentFromCurrentPrice.into());
    }

    // Allocate space for the gameplay token account and initialize its state

    create_or_allocate_account_raw(
        *program_id,
        gameplay_meta_pda_acct,
        system_prog_acct,
        payer_acct,
        GameplayTokenMeta::LEN,
        &[
            GameplayTokenMeta::PREFIX.as_bytes(),
            &random_seed.to_le_bytes(),
        ],
    )?;

    let clock = Clock::get()?;

    let gameplay_token_meta = GameplayTokenMeta {
        acct_type: PlaceAccountType::GameplayTokenMeta,
        gameplay_type: token_type,
        created_at_slot: clock.slot,
        random_seed: random_seed,
        token_mint_pda: gameplay_token_mint_pda,
        update_allowed_slot: clock.slot,
    };

    gameplay_token_meta.serialize(&mut *gameplay_meta_pda_acct.data.borrow_mut())?;

    // pay for the token

    invoke(
        &system_instruction::transfer(&payer_acct.key, &place_state_pda, price),
        &[
            (*payer_acct).clone(),
            (*place_state_pda_acct).clone(),
            (*system_prog_acct).clone(),
        ],
    )?;

    // Create token mint

    let init_mint_ix = initialize_mint(
        &spl_token::id(),
        &gameplay_token_mint_pda,
        &place_state_pda,
        None,
        0,
    )?;

    invoke_signed(
        &init_mint_ix,
        &[
            (*token_prog_acct).clone(),
            (*place_state_pda_acct).clone(),
            (*gameplay_token_mint_pda_acct).clone(),
            (*rent_sysvar_acct).clone(),
        ],
        // TODO(will): Do these need to be in one array?
        &[&[PlaceState::PREFIX.as_bytes(), &[place_state_pda_bump]]],
    )?;

    // Create associated token account
    // TODO(will): figure out what hapens if this account already exists

    let create_ata_ix =
        create_associated_token_account(payer_acct.key, payer_acct.key, &gameplay_token_mint_pda);

    invoke_signed(
        &create_ata_ix,
        &[
            (*gameplay_token_ata_acct).clone(),
            (*payer_acct).clone(),
            (*gameplay_token_mint_pda_acct).clone(),
            (*ata_prog_acct).clone(),
            (*rent_sysvar_acct).clone(),
            (*system_prog_acct).clone(),
        ],
        &[],
    )?;

    // Mint NFT into ATA

    let mint_token_ix = spl_token::instruction::mint_to(
        token_prog_acct.key,
        gameplay_token_mint_pda_acct.key,
        gameplay_token_ata_acct.key,
        place_state_pda_acct.key,
        &[place_state_pda_acct.key],
        1,
    )?;

    invoke_signed(
        &mint_token_ix,
        &[
            (*token_prog_acct).clone(),
            (*gameplay_token_mint_pda_acct).clone(),
            (*place_state_pda_acct).clone(),
            (*gameplay_token_mint_pda_acct).clone(),
            // Do I need to add this? we will find out (*payer_acct).clone(),
        ],
        // TODO(will): Do these need to be in one array?
        &[&[PlaceState::PREFIX.as_bytes(), &[place_state_pda_bump]]],
    )?;

    // TODO(will): create token metadata

    // let meta_program_id = mpl_token_metadata::id();
    // create_metadata_accounts_v2

    // TODO(will): maybe remove authority to hard limit supply to one

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

    if *system_acct.key != solana_program::system_program::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

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
