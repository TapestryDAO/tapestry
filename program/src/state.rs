use solana_program::{program_pack::IsInitialized, pubkey::Pubkey, entrypoint::ProgramResult};

use borsh::{BorshDeserialize, BorshSerialize};

use crate::error::TapestryError;

/// Prefix used to generate the PDA for the tapestry state account
pub const TAPESTRY_PDA_PREFIX: &str = "tapestry";

/// Prefix used to determine the PDA for the mint account associated with a patch
pub const TAPESTRY_MINT_PDA_PREFIX: &str = "mint";

pub const TAPESTRY_STATE_MAX_LEN: usize = 8 + 32 + 8;

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone, Copy)]
pub struct TapestryState {
    pub is_initialized: bool,
    /// Owner of this tapestry, this account receives proceeds from token sales
    pub owner: Pubkey,

    /// Price of an empty pixel patch in lamports
    pub initial_sale_price: u64,
}

impl IsInitialized for TapestryState {
    fn is_initialized(&self) -> bool {
        return self.is_initialized;
    }
}

pub const MAX_X: i16 = 1023;
pub const MIN_X: i16 = -1024;
pub const MAX_Y: i16 = 1023;
pub const MIN_Y: i16 = -1024;

pub const MAX_PATCH_IMAGE_DATA_LEN: usize = 1024;
pub const MAX_PATCH_URL_LEN: usize = 128;
pub const MAX_PATCH_HOVER_TEXT_LEN: usize = 64;

pub const MAX_PATCH_TOTAL_LEN: usize = 0 + 
    1 + // is_initialized
    32 + // owned_by_mint
    8 + // x_region
    8 + // y_region
    2 + // x
    2 + // y
    1 + 4 + MAX_PATCH_URL_LEN + // url
    1 + 4 + MAX_PATCH_HOVER_TEXT_LEN + // hover text
    1 + 4 + MAX_PATCH_IMAGE_DATA_LEN; // image data

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct TapestryPatch {
    pub is_initialized: bool,
    /// pubkey of the token mint associated with ownership of this patch
    /// Only the owner of the NFT minted by this token mint can update the patch data
    pub owned_by_mint: Pubkey,

    /// bit pattern used to query RPC nodes for a local grouping of patches using memcmp
    pub x_region: u64,
    /// bit pattern used to query RPC nodes for a local grouping of patches using memcmp
    pub y_region: u64,

    /// X coordinate of the patch
    pub x: i16,

    /// Y coordinate of the patch
    pub y: i16,

    /// URL which users will be directed to when clicking a patch
    pub url: Option<String>,

    /// text that will display when a user hovers over this patch
    pub hover_text: Option<String>,

    /// Image data for the patch
    pub image_data: Option<Vec<u8>>,
}

pub fn assert_patch_is_valid(
    patch: &TapestryPatch,
) -> ProgramResult {

    if !patch.is_initialized {
        return Err(TapestryError::UnexpectedPatchState.into());
    }

    if patch.url.is_some() && patch.url.as_ref().unwrap().len() > MAX_PATCH_URL_LEN {
        return Err(TapestryError::PatchURLTooLong.into());
    }
    
    if patch.hover_text.is_some() && patch.hover_text.as_ref().unwrap().len() > MAX_PATCH_HOVER_TEXT_LEN {
        return Err(TapestryError::PatchHoverTextTooLong.into());
    }

    if patch.image_data.is_some() && patch.image_data.as_ref().unwrap().len() > MAX_PATCH_IMAGE_DATA_LEN {
        return Err(TapestryError::PatchImageDataTooLong.into());
    }

    // TODO(will): maybe check patch owner

    Ok(())
}

impl IsInitialized for TapestryPatch {
    fn is_initialized(&self) -> bool {
        return self.is_initialized;
    }
}


// TODO(will): where to put these?

pub fn find_tapestry_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[
        TAPESTRY_PDA_PREFIX.as_bytes(),
    ], program_id)
}

pub fn find_patch_address_for_patch_coords(x: i16, y: i16, program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[
        TAPESTRY_PDA_PREFIX.as_bytes(),
        &x.to_le_bytes(),
        &y.to_le_bytes(),
    ], program_id)
}

pub fn find_mint_address_for_patch_coords(x: i16, y: i16, program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[
        TAPESTRY_PDA_PREFIX.as_bytes(),
        TAPESTRY_MINT_PDA_PREFIX.as_bytes(),
        &x.to_le_bytes(),
        &y.to_le_bytes(),
    ], program_id)
}