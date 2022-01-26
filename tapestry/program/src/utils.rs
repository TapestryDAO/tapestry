use crate::{
    error::TapestryError,
    state::{CHUNK_SIZE, MAX_X, MAX_Y, MIN_X, MIN_Y},
};

use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
};
use std::convert::TryInto;

#[derive(Debug)]
pub struct ChunkCoords {
    pub x_chunk: i8,
    pub y_chunk: i8,
}

#[inline(always)]
pub fn chunk_for_coords(x: i16, y: i16) -> ChunkCoords {
    // NOTE(will): maybe assert coords valid here?
    let x_chunk = if x >= 0 {
        x / CHUNK_SIZE
    } else {
        ((x + 1) / CHUNK_SIZE) - 1
    } as i8;

    let y_chunk = if y >= 0 {
        y / CHUNK_SIZE
    } else {
        ((y + 1) / CHUNK_SIZE) - 1
    } as i8;

    return ChunkCoords { x_chunk, y_chunk };
}

#[inline(always)]
pub fn assert_coords_valid(x: i16, y: i16) -> ProgramResult {
    let valid = x <= MAX_X && x >= MIN_X && y <= MAX_Y && y >= MIN_Y;
    if valid {
        return Ok(());
    } else {
        return Err(TapestryError::InvalidPatchCoordinates.into());
    }
}

pub fn assert_signer(account_info: &AccountInfo) -> ProgramResult {
    if !account_info.is_signer {
        Err(ProgramError::MissingRequiredSignature)
    } else {
        Ok(())
    }
}

pub fn assert_owned_by(account_info: &AccountInfo, owner: &Pubkey) -> ProgramResult {
    if account_info.owner != owner {
        Err(TapestryError::IncorrectOwner.into())
    } else {
        Ok(())
    }
}

/// Create account almost from scratch, lifted from
/// https://github.com/solana-labs/solana-program-library/tree/master/associated-token-account/program/src/processor.rs#L51-L98
#[inline(always)]
pub fn create_or_allocate_account_raw<'a>(
    program_id: Pubkey,
    new_account_info: &AccountInfo<'a>,
    system_program_info: &AccountInfo<'a>,
    payer_info: &AccountInfo<'a>,
    size: usize,
    signer_seeds: &[&[u8]],
) -> ProgramResult {
    let rent = Rent::get()?;
    let required_lamports = rent
        .minimum_balance(size)
        .max(1)
        .saturating_sub(new_account_info.lamports());

    if required_lamports > 0 {
        msg!("Transfer {} lamports to the new account", required_lamports);
        invoke(
            &system_instruction::transfer(&payer_info.key, new_account_info.key, required_lamports),
            &[
                payer_info.clone(),
                new_account_info.clone(),
                system_program_info.clone(),
            ],
        )?;
    }

    let accounts = &[new_account_info.clone(), system_program_info.clone()];

    msg!("Allocate space for the account");
    invoke_signed(
        &system_instruction::allocate(new_account_info.key, size.try_into().unwrap()),
        accounts,
        &[&signer_seeds],
    )?;

    msg!("Assign the account to the owning program");
    invoke_signed(
        &system_instruction::assign(new_account_info.key, &program_id),
        accounts,
        &[&signer_seeds],
    )?;

    Ok(())
}
