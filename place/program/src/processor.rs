use std::convert::TryFrom;

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_pack::Pack,
    pubkey::Pubkey,
    system_instruction, sysvar,
    sysvar::{clock::Clock, rent::Rent, Sysvar},
};

use crate::{
    id,
    instruction::{
        InitMintAccountArgs, InitMintDataArgs, InitPatchAccountArgs, InitPatchDataArgs,
        PlaceInstruction, PurchaseGameplayTokenAccountArgs, PurchaseGameplayTokenDataArgs,
        SetPixelAccountArgs, SetPixelDataArgs, UpdatePlaceStateAccountArgs,
        UpdatePlaceStateDataArgs,
    },
    utils::{assert_system_prog, assert_token_prog},
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

use mpl_token_metadata::{instruction::create_metadata_accounts_v2, state::Collection};

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
            PlaceInstruction::InitMint(args) => {
                let acct_info_iter = &mut accounts.iter();

                let acct_args = InitMintAccountArgs {
                    owner_acct: next_account_info(acct_info_iter)?,
                    place_state_pda_acct: next_account_info(acct_info_iter)?,
                    place_token_mint_pda_acct: next_account_info(acct_info_iter)?,
                    token_prog_acct: next_account_info(acct_info_iter)?,
                    system_prog_acct: next_account_info(acct_info_iter)?,
                    rent_sysvar_acct: next_account_info(acct_info_iter)?,
                };

                process_init_mint(program_id, acct_args, args)
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

                let acct_args = PurchaseGameplayTokenAccountArgs {
                    payer_acct: next_account_info(acct_info_iter)?,
                    place_state_pda_acct: next_account_info(acct_info_iter)?,
                    gameplay_meta_pda_acct: next_account_info(acct_info_iter)?,
                    gameplay_token_mint_pda_acct: next_account_info(acct_info_iter)?,
                    gameplay_token_ata_acct: next_account_info(acct_info_iter)?,
                    gameplay_token_mpl_meta_acct: next_account_info(acct_info_iter)?,
                    mpl_metadata_prog_acct: next_account_info(acct_info_iter)?,
                    token_prog_acct: next_account_info(acct_info_iter)?,
                    ata_prog_acct: next_account_info(acct_info_iter)?,
                    system_prog_acct: next_account_info(acct_info_iter)?,
                    rent_sysvar_acct: next_account_info(acct_info_iter)?,
                };

                process_purchase_gameplay_token(program_id, acct_args, args)
            }
            PlaceInstruction::SetPixel(args) => {
                let acct_info_iter = &mut accounts.iter();

                let acct_args = SetPixelAccountArgs {
                    payer_acct: next_account_info(acct_info_iter)?,
                    patch_pda_acct: next_account_info(acct_info_iter)?,
                    gameplay_token_meta_acct: next_account_info(acct_info_iter)?,
                    payer_gameplay_token_acct: next_account_info(acct_info_iter)?,
                    system_acct: next_account_info(acct_info_iter)?,
                };

                process_set_pixel(program_id, acct_args, &args)
            }
        }
    }
}

fn process_init_mint(
    program_id: &Pubkey,
    acct_args: InitMintAccountArgs,
    data_args: InitMintDataArgs,
) -> ProgramResult {
    let InitMintAccountArgs {
        owner_acct,
        place_state_pda_acct,
        place_token_mint_pda_acct,
        token_prog_acct,
        system_prog_acct,
        rent_sysvar_acct,
    } = acct_args;

    assert_signer(owner_acct)?;
    assert_system_prog(system_prog_acct)?;
    assert_token_prog(token_prog_acct)?;

    let (place_state_pda, _) = PlaceState::pda();
    if place_state_pda != *place_state_pda_acct.key {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

    let place_state = PlaceState::from_account_info(place_state_pda_acct)?;

    if place_state.owner != *owner_acct.key {
        return Err(PlaceError::InvalidOwner.into());
    }

    let (place_token_mint_pda, place_token_mint_pda_bump) = PlaceState::token_mint_pda();
    if place_token_mint_pda != *place_token_mint_pda_acct.key {
        return Err(PlaceError::InvalidPlaceTokenMintPDA.into());
    }

    if !place_token_mint_pda_acct.data_is_empty() {
        return Err(PlaceError::PlaceTokenMintAlreadyInitialized.into());
    }

    let place_token_mint_seeds = &[
        PlaceState::PREFIX.as_bytes(),
        PlaceState::TOKEN_MINT_PREFIX.as_bytes(),
        &[place_token_mint_pda_bump],
    ];

    create_or_allocate_account_raw(
        *token_prog_acct.key,
        place_token_mint_pda_acct,
        system_prog_acct,
        owner_acct,
        Mint::LEN,
        place_token_mint_seeds,
    )?;

    let init_mint_ix = initialize_mint(
        &spl_token::id(),
        &place_token_mint_pda,
        &place_state_pda,
        None,
        0,
    )?;

    msg!("TAP: Creating Token Mint");

    invoke_signed(
        &init_mint_ix,
        &[
            (*token_prog_acct).clone(),
            (*place_state_pda_acct).clone(),
            (*place_token_mint_pda_acct).clone(),
            (*rent_sysvar_acct).clone(),
        ],
        &[place_token_mint_seeds],
    )?;

    Ok(())
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
        gameplay_token_mpl_meta_acct,
        mpl_metadata_prog_acct,
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

    let (gameplay_token_mpl_meta_pda, _) = GameplayTokenMeta::token_metadata_pda(random_seed);
    if *gameplay_token_mpl_meta_acct.key != gameplay_token_mpl_meta_pda {
        return Err(PlaceError::InvalidAccountArgument.into());
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

    if *mpl_metadata_prog_acct.key != mpl_token_metadata::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

    if *rent_sysvar_acct.key != sysvar::rent::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

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

    // -- pay for the token
    msg!("TAP: Paying for token");

    // NOTE(will): we do this before the gameplay account allocation so save an invoke
    // this has the effect of reducing our fee by the rent overhead of the gameplay token account
    invoke(
        &system_instruction::transfer(&payer_acct.key, &gameplay_meta_pda, price),
        &[
            (*payer_acct).clone(),
            (*gameplay_meta_pda_acct).clone(),
            (*system_prog_acct).clone(),
        ],
    )?;

    // -- Allocate space for the gameplay token account and initialize its state
    msg!("TAP: Allocating gameplay token");

    let gameplay_meta_pda_seeds = &[
        GameplayTokenMeta::PREFIX.as_bytes(),
        &random_seed.to_le_bytes(),
        &[gameplay_meta_pda_bump],
    ];

    create_or_allocate_account_raw(
        *program_id,
        gameplay_meta_pda_acct,
        system_prog_acct,
        payer_acct,
        GameplayTokenMeta::LEN,
        gameplay_meta_pda_seeds,
    )?;

    let clock = Clock::get()?;

    let gameplay_token_meta = GameplayTokenMeta {
        acct_type: PlaceAccountType::GameplayTokenMeta,
        gameplay_type: token_type,
        created_at_slot: clock.slot,
        random_seed: random_seed,
        token_mint_pda: gameplay_token_mint_pda,
        update_allowed_slot: clock.slot,
        cooldown_duration: state.paintbrush_cooldown,
    };

    // -- Allocate space for the token mint and initialize it
    msg!("TAP: Allocating token mint");

    let gameplay_token_mint_pda_seeds = &[
        GameplayTokenMeta::PREFIX.as_bytes(),
        &random_seed.to_le_bytes(),
        GameplayTokenMeta::MINT_PREFIX.as_bytes(),
        &[gameplay_token_mint_pda_bump],
    ];

    let place_state_acct_pda_seeds = &[PlaceState::PREFIX.as_bytes(), &[place_state_pda_bump]];

    create_or_allocate_account_raw(
        *token_prog_acct.key,
        gameplay_token_mint_pda_acct,
        system_prog_acct,
        payer_acct,
        Mint::LEN,
        gameplay_token_mint_pda_seeds,
    )?;

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
        &[place_state_acct_pda_seeds],
    )?;

    // -- Create associated token account
    msg!("TAP: Creating ATA");

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

    // -- Mint NFT into ATA
    msg!("TAP: Minting NFT into ATA");

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
            (*gameplay_token_ata_acct).clone(),
            (*place_state_pda_acct).clone(),
            // Do I need to add this? we will find out (*payer_acct).clone(),
        ],
        &[place_state_acct_pda_seeds],
    )?;

    // -- Create the metaplex token metadata
    msg!("TAP: Creating mpl metadata");

    let token_name = match token_type {
        GameplayTokenType::Bomb => String::from("Tapestry Bomb"),
        GameplayTokenType::PaintBrush => String::from("Tapestry Paintbrush"),
    };

    let token_uri = match token_type {
        GameplayTokenType::Bomb => String::from("http://localhost:8080/bomb.json"),
        GameplayTokenType::PaintBrush => String::from("http://localhost:8080/paintbrush.json"),
    };

    let create_mpl_meta_ix = create_metadata_accounts_v2(
        mpl_token_metadata::id(),
        gameplay_token_mpl_meta_pda,
        gameplay_token_mint_pda.clone(),
        place_state_pda.clone(),
        payer_acct.key.clone(),
        place_state_pda.clone(),
        token_name,
        String::from("Tapestry"),
        token_uri,
        None,
        0,
        true,
        false,
        Some(Collection {
            verified: false, // have to do this via a separate instruction
            key: place_state_pda.clone(),
        }),
        None, // this is "uses", can this be leveraged for bombs?
    );

    invoke_signed(
        &create_mpl_meta_ix,
        &[
            (*mpl_metadata_prog_acct).clone(),
            (*gameplay_token_mint_pda_acct).clone(),
            (*payer_acct).clone(),
            (*place_state_pda_acct).clone(),
            (*rent_sysvar_acct).clone(),
            (*system_prog_acct).clone(),
            (*gameplay_token_mpl_meta_acct).clone(),
        ],
        &[gameplay_token_mint_pda_seeds, place_state_acct_pda_seeds],
    )?;

    // TODO(will): maybe verify the colleciton using verify_collection ix?

    // TODO(will): maybe remove authority to hard limit supply to one

    // IMPORTANT - save the game state, for some reason if i do this earlier the transfer
    // of SOL to this account fails
    gameplay_token_meta.serialize(&mut *gameplay_meta_pda_acct.data.borrow_mut())?;

    Ok(())
}

// Thought process on question of storing the "cooldown" time in the global state account
// versus storing on each gameplay token.
// Store on token meta accounts:
//   PRO: fewer account args to set pixel
//   CON: duplicate a u64 across all tokens (more space)
//   PRO: save compute on set pixel by not parsing an additional account
//   PRO or CON: gameplay tokens are locked in to their cooldown rate
// Store on global state account:
//   CON: less bytes for each token purchase
//   PRO or CON: could slow down or speed up the game by changing one variable in global state
//
// Based on this, seems better to store in the token account than use global state

fn process_set_pixel(
    program_id: &Pubkey,
    acct_args: SetPixelAccountArgs,
    data_args: &SetPixelDataArgs,
) -> ProgramResult {
    let SetPixelAccountArgs {
        payer_acct,
        patch_pda_acct,
        gameplay_token_meta_acct,
        payer_gameplay_token_acct,
        system_acct,
    } = acct_args;

    let SetPixelDataArgs {
        x,
        y,
        x_offset,
        y_offset,
        pixel,
    } = data_args;

    // everything is based on the signer owning a token account with a balance of 1,
    // and with a mint that matches the mint in the gameplay token meta
    // so payer had better be signer.
    assert_signer(payer_acct)?;

    // TODO(will): check token acct is owned by token program or whatever
    // also maybe check ownership on other accounts

    if *system_acct.key != solana_program::system_program::id() {
        return Err(PlaceError::InvalidAccountArgument.into());
    }

    // Parse and validate account arguments

    let mut patch: Patch = Patch::from_account_info(patch_pda_acct)?;
    let (patch_pda, _) = patch.pda_for_instance();
    if patch_pda != *patch_pda_acct.key {
        return Err(PlaceError::IncorrectPatchPDA.into());
    }

    if *x != patch.x || *y != patch.y {
        return Err(PlaceError::IncorrectPatchPDA.into());
    }

    let mut gameplay_token: GameplayTokenMeta =
        GameplayTokenMeta::from_account_info(gameplay_token_meta_acct)?;
    let (gameplay_token_pda, _) = gameplay_token.pda_for_instance();
    if gameplay_token_pda != *gameplay_token_meta_acct.key {
        return Err(PlaceError::IncorrectGameplayTokenMetaPDA.into());
    }

    // check the token account looks good
    let gameplay_ata = TokenAccount::unpack_from_slice(&payer_gameplay_token_acct.data.borrow())?;
    if gameplay_ata.owner != *payer_acct.key {
        return Err(PlaceError::InvalidGameplayTokenAccountOwner.into());
    }
    if gameplay_ata.amount != 1 {
        return Err(PlaceError::InvalidGameplayTokenAccountBalance.into());
    }
    if gameplay_ata.mint != gameplay_token.token_mint_pda {
        return Err(PlaceError::InvalidGameplayTokenAccountMint.into());
    }

    // check the gameplay token meta to make sure it is "ready"

    let clock = Clock::get()?;
    let current_slot = clock.slot;
    if gameplay_token.update_allowed_slot > current_slot {
        return Err(PlaceError::GameplayTokenNotReady.into());
    }
    msg!(
        "TAP: current_slot: {}, allowed_after: {}",
        current_slot,
        gameplay_token.update_allowed_slot
    );

    // update the cooldown for the token
    gameplay_token.update_allowed_slot = current_slot + gameplay_token.cooldown_duration;
    gameplay_token.serialize(&mut *gameplay_token_meta_acct.data.borrow_mut())?;

    // Change the pixel

    let y_offset_usize = *y_offset as usize;
    let x_offset_usize = *x_offset as usize;

    let idx = (y_offset_usize * PATCH_SIZE_PX) + x_offset_usize;
    patch.pixels[idx] = *pixel;
    patch.serialize(&mut *patch_pda_acct.data.borrow_mut())?;

    Ok(())
}
