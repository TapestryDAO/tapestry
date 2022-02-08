use crate::state::{
    assert_featured_region_valid, find_featured_state_address, find_mint_address_for_patch_coords,
    find_patch_address_for_patch_coords, find_tapestry_state_address, FeaturedRegion,
};
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::AccountInfo,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    sysvar,
};

/// Args for initializing a new tapestry
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitTapestryDataArgs {
    pub initial_sale_price: u64,
}

pub struct InitTapestryAccountArgs<'a, 'b: 'a> {
    /// `[signer]` The account that will own this tapestry, also the payer for this tx
    pub owner_acct: &'a AccountInfo<'b>,
    /// `[writable]` A pda account using TAPESTRY_PDA_PREFIX
    ///
    /// NOTE(will): PDA accounts are limited to 10kb of data, if we exceed that in state, we would need
    /// to pass in an account which the PDA then takes ownership of.
    pub tapestry_state_acct: &'a AccountInfo<'b>,
    /// `[]` The system program
    pub system_acct: &'a AccountInfo<'b>,

    /// `[writable]` The account to hold the featured section
    pub featured_state_acct: &'a AccountInfo<'b>,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PurchasePatchDataArgs {
    pub x: i16,
    pub y: i16,
}

pub struct PurchasePatchAccountArgs<'a, 'b: 'a> {
    /// `[signer]` The account purchasing the patch
    pub buyer_acct: &'a AccountInfo<'b>,

    /// `[]` The tapestry state PDA account derived from prefix TAPESTRY_PDA_PREFIX
    pub tapestry_state_acct: &'a AccountInfo<'b>,

    /// '[]' The unique PDA for this patch
    pub tapestry_patch_acct: &'a AccountInfo<'b>,

    /// '[]' The unique PDA for the patch mint
    pub tapestry_patch_mint_acct: &'a AccountInfo<'b>,

    /// '[]' The token account which will receive the newly minted NFT
    pub associated_token_acct_for_patch: &'a AccountInfo<'b>,

    /// '[]' The token program
    pub token_prog_acct: &'a AccountInfo<'b>,

    /// '[]' The associated token program for creating a token account to receive the new NFT
    pub associated_token_prog_acct: &'a AccountInfo<'b>,

    /// '[]' The rent sysvar account (needed by spl token program)
    pub rent_sysvar_acct: &'a AccountInfo<'b>,

    /// `[]` The system program
    pub system_prog_acct: &'a AccountInfo<'b>,

    /// `[]` The metaplex metadata program
    pub mpl_token_metadata_acct: &'a AccountInfo<'b>,

    /// '[writable]' The pda for the metaplex token metadata
    pub mpl_metadata_pda_acct: &'a AccountInfo<'b>,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct UpdatePatchImageDataArgs {
    pub x: i16,
    pub y: i16,
    pub image_data: Vec<u8>,
}

/// Want to keep number of accounts here as minimal as possible to make room for data
/// This struct is used for both UpdatePatchImage and UpdatePatchMetadata
pub struct UpdatePatchAccountArgs<'a, 'b: 'a> {
    /// The owner of the patch
    pub owner_acct: &'a AccountInfo<'b>,

    /// token account that holds the NFT owning the patch
    pub token_acct: &'a AccountInfo<'b>,

    /// The patch account holding the patch data
    pub patch_acct: &'a AccountInfo<'b>,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct UpdatePatchMetadataDataArgs {
    pub x: i16,
    pub y: i16,

    // NOTE(will): presently, if None is passed, the data field in the account is set to none
    // Should None indicate to simply skip updating that field instead?
    pub url: Option<String>,
    pub hover_text: Option<String>,
}

pub struct PushFeaturedAccountArgs<'a, 'b: 'a> {
    /// `[signer]` The tapestry owner account
    pub owner_acct: &'a AccountInfo<'b>,

    /// `[]` The tapestry state acct (needed to verify owner)
    pub tapestry_state_acct: &'a AccountInfo<'b>,

    /// `[writable]` The account to hold the featured section
    pub featured_state_acct: &'a AccountInfo<'b>,

    /// `[]` The system program
    pub system_acct: &'a AccountInfo<'b>,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PushFeaturedDataArgs {
    pub region: FeaturedRegion,
}

/// Instructions used by the Tapestry Program

#[derive(BorshSerialize, BorshDeserialize, Clone)]
pub enum TapestryInstruction {
    /// InitTapestryAccountArgs
    InitTapestry(InitTapestryDataArgs),

    /// Purchase a patch of pixels at the x, y coordinates provided in data args
    PurchasePatch(PurchasePatchDataArgs),

    // separate ix to update the patch image so more data
    // can fit in the data payload
    UpdatePatchImage(UpdatePatchImageDataArgs),

    // Update the url and hover text for the patch
    UpdatePatchMetadata(UpdatePatchMetadataDataArgs),

    // Push Featured
    PushFeatured(PushFeaturedDataArgs),
}

pub fn get_ix_init_tapestry(
    program_id: Pubkey,
    owner_acct: Pubkey,
    initial_sale_price: u64,
) -> Instruction {
    let (tapestry_state_acct, _) = find_tapestry_state_address(&program_id);
    let (featured_state_acct, _) = find_featured_state_address(&program_id);
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(owner_acct, true),
            AccountMeta::new(tapestry_state_acct, false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new(featured_state_acct, false),
        ],
        data: TapestryInstruction::InitTapestry(InitTapestryDataArgs {
            initial_sale_price: initial_sale_price,
        })
        .try_to_vec()
        .unwrap(),
    }
}

pub fn get_ix_purchase_patch(
    program_id: Pubkey,
    buyer_acct: Pubkey,
    x: i16,
    y: i16,
) -> Instruction {
    let (tapestry_state_acct, _) = find_tapestry_state_address(&program_id);
    let (tapestry_patch_acct, _) = find_patch_address_for_patch_coords(x, y, &program_id);
    let (tapestry_patch_mint_acct, _) = find_mint_address_for_patch_coords(x, y, &program_id);
    let ata = spl_associated_token_account::get_associated_token_address(
        &buyer_acct,
        &tapestry_patch_mint_acct,
    );

    let meta_program_id = mpl_token_metadata::id();
    let metadata_seeds = &[
        mpl_token_metadata::state::PREFIX.as_bytes(),
        meta_program_id.as_ref(),
        tapestry_patch_mint_acct.as_ref(),
    ];

    let (metadata_pda, _) = Pubkey::find_program_address(metadata_seeds, &meta_program_id);
    // Do I need another account, such that the patch_pda isn't both the owner and the account address?
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(buyer_acct, true),
            AccountMeta::new(tapestry_state_acct, false),
            AccountMeta::new(tapestry_patch_acct, false),
            AccountMeta::new(tapestry_patch_mint_acct, false),
            AccountMeta::new(ata, false),
            AccountMeta::new_readonly(spl_token::id(), false),
            AccountMeta::new_readonly(spl_associated_token_account::id(), false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(mpl_token_metadata::id(), false),
            AccountMeta::new(metadata_pda, false),
        ],
        data: TapestryInstruction::PurchasePatch(PurchasePatchDataArgs { x: x, y: y })
            .try_to_vec()
            .unwrap(),
    }
}

pub fn get_ix_update_patch_image(
    program_id: Pubkey,
    owner_acct: Pubkey,
    x: i16,
    y: i16,
    image_data: Vec<u8>,
) -> Instruction {
    let (tapestry_patch_acct, _) = find_patch_address_for_patch_coords(x, y, &program_id);
    let (tapestry_patch_mint_acct, _) = find_mint_address_for_patch_coords(x, y, &program_id);
    let ata = spl_associated_token_account::get_associated_token_address(
        &owner_acct,
        &tapestry_patch_mint_acct,
    );

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(owner_acct, true),
            AccountMeta::new_readonly(ata, false),
            AccountMeta::new(tapestry_patch_acct, false),
        ],
        data: TapestryInstruction::UpdatePatchImage(UpdatePatchImageDataArgs {
            x: x,
            y: y,
            image_data: image_data,
        })
        .try_to_vec()
        .unwrap(),
    }
}

pub fn get_ix_update_patch_metadata(
    program_id: Pubkey,
    owner_acct: Pubkey,
    x: i16,
    y: i16,
    url: Option<String>,
    hover_text: Option<String>,
) -> Instruction {
    let (tapestry_patch_acct, _) = find_patch_address_for_patch_coords(x, y, &program_id);
    let (tapestry_patch_mint_acct, _) = find_mint_address_for_patch_coords(x, y, &program_id);
    let ata = spl_associated_token_account::get_associated_token_address(
        &owner_acct,
        &tapestry_patch_mint_acct,
    );

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(owner_acct, true),
            AccountMeta::new_readonly(ata, false),
            AccountMeta::new(tapestry_patch_acct, false),
        ],
        data: TapestryInstruction::UpdatePatchMetadata(UpdatePatchMetadataDataArgs {
            x: x,
            y: y,
            url: url,
            hover_text: hover_text,
        })
        .try_to_vec()
        .unwrap(),
    }
}

pub fn get_ix_push_featured(owner_acct: Pubkey, featured_region: FeaturedRegion) -> Instruction {
    let program_id = crate::id();
    let (tapestry_state_acct, _) = find_tapestry_state_address(&program_id);
    let (featured_state_acct, _) = find_featured_state_address(&program_id);
    let result = assert_featured_region_valid(&featured_region);

    if let Err(e) = result {
        println!("Warning: Invalid featured region, tx will fail - {}", e);
    }

    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new_readonly(owner_acct, true),
            AccountMeta::new_readonly(tapestry_state_acct, false),
            AccountMeta::new(featured_state_acct, false),
            AccountMeta::new(solana_program::system_program::id(), false),
        ],
        data: TapestryInstruction::PushFeatured(PushFeaturedDataArgs {
            region: featured_region,
        })
        .try_to_vec()
        .unwrap(),
    }
}
