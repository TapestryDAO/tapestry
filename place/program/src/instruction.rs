use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{Account, AccountInfo},
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
};

use crate::state::find_address_for_patch;

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum PlaceInstruction {
    PurchaseAccount(PurchaseAccountDataArgs),

    SetPixel(SetPixelDataArgs),
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct SetPixelDataArgs {
    pub x: u8,
    pub y: u8,
    pub x_offset: u8,
    pub y_offset: u8,

    // 8 bit value, which gets mapped to a 32 bit color from a pallete on clients
    pub pixel: u8,
}

pub struct SetPixelAccountArgs<'a, 'b: 'a> {
    // `[signer]` Fee payer for this tx
    pub payer_acct: &'a AccountInfo<'b>,

    // `[writable]` the pda of the patch being set
    pub patch_pda_acct: &'a AccountInfo<'b>,

    pub system_acct: &'a AccountInfo<'b>,
}

pub fn get_ix_set_pixel(
    program_id: Pubkey,
    payer: Pubkey,
    x: u8,
    y: u8,
    x_offset: u8,
    y_offset: u8,
    pixel: u8,
) -> Instruction {
    let (patch_pda, _) = find_address_for_patch(x, y, &program_id);

    Instruction {
        program_id,
        accounts: vec![
            // TODO(will): this doesn't need to be writable after removing lazy alloc
            AccountMeta::new(payer, true),
            AccountMeta::new(patch_pda, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
        data: PlaceInstruction::SetPixel(SetPixelDataArgs {
            x: x,
            y: y,
            x_offset: x_offset,
            y_offset: y_offset,
            pixel: pixel,
        })
        .try_to_vec()
        .unwrap(),
    }
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PurchaseAccountDataArgs {
    // any?
}

pub struct PurchaseAccountAccountArgs<'a, 'b: 'a> {
    /// `[signer]` Account that will own this... account... fuck
    pub payer_acct: &'a AccountInfo<'b>,
}
