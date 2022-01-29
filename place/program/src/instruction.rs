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
    pub xOffset: u8,
    pub yOffset: u8,
    // RGB pixel value
    pub pixel: [u8; 3],
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
    xOffset: u8,
    yOffset: u8,
    pixel: [u8; 3],
) -> Instruction {
    let (patch_pda, _) = find_address_for_patch(x, y, &program_id);

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(patch_pda, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
        data: PlaceInstruction::SetPixel(SetPixelDataArgs {
            x: x,
            y: y,
            xOffset: xOffset,
            yOffset: yOffset,
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
