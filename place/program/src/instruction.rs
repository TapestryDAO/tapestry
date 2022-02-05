use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{Account, AccountInfo},
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    sysvar,
};

use crate::state::{find_address_for_patch, GameplayTokenMeta, GameplayTokenType, PlaceState};

#[derive(BorshSerialize, BorshDeserialize, Debug, Clone)]
pub enum PlaceInstruction {
    UpdatePlaceState(UpdatePlaceStateDataArgs),

    // Allocate a patch
    InitPatch(InitPatchDataArgs),

    // Purchase a token that allows setting pixels
    PurchaseGameplayToken(PurchaseGameplayTokenDataArgs),

    // Set a pixel to a particular value
    SetPixel(SetPixelDataArgs),
}

//////////////////////////////////////////////////////////////////////////////////
////////////////////////// UPDATE TAPESTRY STATE /////////////////////////////////

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct UpdatePlaceStateDataArgs {
    // The owner the tapestry, if different from the current owner, this will be set
    pub new_owner: Option<Pubkey>,

    // is the tapestry frozen
    pub is_frozen: Option<bool>,

    // price of a token of type Paintbrush in lamports
    pub paintbrush_price: Option<u64>,

    // number of seconds for the cooldown of new paintbrushes
    pub paintbrush_cooldown: Option<u64>,

    // price of a token of type Bomb in lamports
    pub bomb_price: Option<u64>,
}

pub struct UpdatePlaceStateAccountArgs<'a, 'b: 'a> {
    /// `[signer]` fee payer and current owner
    pub current_owner_acct: &'a AccountInfo<'b>,

    /// `[writable]` pda of the place state account
    pub place_state_pda_acct: &'a AccountInfo<'b>,

    /// `[]` system program acct
    pub system_acct: &'a AccountInfo<'b>,
}

pub fn get_ix_update_place_state(
    current_owner: Pubkey,
    new_owner: Option<Pubkey>,
    is_frozen: Option<bool>,
    paintbrush_price: Option<u64>,
    paintbrush_cooldown: Option<u64>,
    bomb_price: Option<u64>,
) -> Instruction {
    let (place_state_pda, _) = PlaceState::pda();
    Instruction {
        program_id: crate::id(),
        accounts: vec![
            AccountMeta::new(current_owner, true),
            AccountMeta::new(place_state_pda, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
        data: PlaceInstruction::UpdatePlaceState(UpdatePlaceStateDataArgs {
            new_owner,
            is_frozen,
            paintbrush_price,
            paintbrush_cooldown,
            bomb_price,
        })
        .try_to_vec()
        .unwrap(),
    }
}

//////////////////////////////////////////////////////////////////////////////////
////////////////////////////////// INIT PATCH ////////////////////////////////////

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitPatchDataArgs {
    pub x_patch: u8,
    pub y_patch: u8,
}

pub struct InitPatchAccountArgs<'a, 'b: 'a> {
    /// `[signer]` the payer for the data allocation
    pub payer_acct: &'a AccountInfo<'b>,

    /// `[writable]` the patch pda we are going to allocate
    pub patch_pda_acct: &'a AccountInfo<'b>,

    /// `[]` the system program
    pub system_acct: &'a AccountInfo<'b>,
}

pub fn get_ix_init_patch(
    program_id: Pubkey,
    payer: Pubkey,
    x_patch: u8,
    y_patch: u8,
) -> Instruction {
    let (patch_pda, _) = find_address_for_patch(x_patch, y_patch, &program_id);

    Instruction {
        program_id,
        accounts: vec![
            // TODO(will): this doesn't need to be writable after removing lazy alloc
            AccountMeta::new(payer, true),
            AccountMeta::new(patch_pda, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],
        data: PlaceInstruction::InitPatch(InitPatchDataArgs { x_patch, y_patch })
            .try_to_vec()
            .unwrap(),
    }
}

//////////////////////////////////////////////////////////////////////////////////
////////////////////////// Purchase GameplayToken ////////////////////////////////

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PurchaseGameplayTokenDataArgs {
    // The type of token to purchase
    pub token_type: GameplayTokenType,

    // Random number used to generate the GameplayTokenAccount PDA
    // this creates a small probability of a collision but avoids a write lock
    // on the purchase instruction
    pub random_seed: u64,

    // The price the buyer is expecting to pay
    pub desired_price: u64,
}

pub struct PurchaseGameplayTokenAccountArgs<'a, 'b: 'a> {
    /// `[signer]` Account that will own this... account... fuck
    pub payer_acct: &'a AccountInfo<'b>,

    /// `[]` PlaceState account
    pub place_state_pda_acct: &'a AccountInfo<'b>,

    // `[writable]` PDA for the GameplayTokenMeta account
    pub gameplay_meta_pda_acct: &'a AccountInfo<'b>,

    // `[writable]` PDA for token mint of NFT controlling the gameplay token
    pub gameplay_token_mint_pda_acct: &'a AccountInfo<'b>,

    // `[writable]` ATA to mint NFT into for the payer
    pub gameplay_token_ata_acct: &'a AccountInfo<'b>,

    // `[writable]` the token metadata account for the NFT
    pub gameplay_token_mpl_meta_acct: &'a AccountInfo<'b>,

    // `[]` The MPL token metadata program account
    pub mpl_metadata_prog_acct: &'a AccountInfo<'b>,

    // `[?]` token program account
    pub token_prog_acct: &'a AccountInfo<'b>,

    // `[?]` associated token program account
    pub ata_prog_acct: &'a AccountInfo<'b>,

    // `[]` the system program
    pub system_prog_acct: &'a AccountInfo<'b>,

    // `[]` the rent sysvar account (needed by token program)
    pub rent_sysvar_acct: &'a AccountInfo<'b>,
}

pub fn get_ix_purchase_gameplay_token(
    payer: Pubkey,
    random_seed: u64,
    token_type: GameplayTokenType,
    desired_price: u64,
) -> Instruction {
    let (place_state_pda, _) = PlaceState::pda();
    let (gameplay_meta_pda, _) = GameplayTokenMeta::pda(random_seed);
    let (gameplay_token_mint_pda, _) = GameplayTokenMeta::token_mint_pda(random_seed);
    let gameplay_token_ata = spl_associated_token_account::get_associated_token_address(
        &payer,
        &gameplay_token_mint_pda,
    );
    let (gameplay_token_mpl_pda, _) = GameplayTokenMeta::token_metadata_pda(random_seed);

    Instruction {
        program_id: crate::id(),
        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(place_state_pda, false),
            AccountMeta::new(gameplay_meta_pda, false),
            AccountMeta::new(gameplay_token_mint_pda, false),
            AccountMeta::new(gameplay_token_ata, false),
            AccountMeta::new(gameplay_token_mpl_pda, false),
            AccountMeta::new_readonly(mpl_token_metadata::id(), false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(spl_associated_token_account::id(), false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
        ],
        data: PlaceInstruction::PurchaseGameplayToken(PurchaseGameplayTokenDataArgs {
            token_type,
            random_seed,
            desired_price,
        })
        .try_to_vec()
        .unwrap(),
    }
}
//////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// SET PIXEL //////////////////////////////////////

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

    // `[]` the system program
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
