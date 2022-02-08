use solana_program::{program_pack::IsInitialized, pubkey::Pubkey, entrypoint::ProgramResult};

use borsh::{BorshDeserialize, BorshSerialize};

use crate::{error::TapestryError, utils::{assert_coords_valid, chunk_for_coords, ChunkCoords}};

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

/// Used to generate PDA for the featured account
pub const TAPESTRY_FEATURED_PDA_PREFIX: &str = "feat";

/// Maximum length for message to display with featured items
pub const MAX_FEATURED_CALLOUT_LEN: usize = 64;

/// Maximum length for the domain string in featured items
pub const MAX_FEATURED_DOMAIN_LEN: usize = 64;

/// Maximum number of featured regions
pub const MAX_FEATURED_REGIONS: usize = 50;


pub const MAX_TAPESTRY_FEATURED_ACCOUNT_LEN: usize = 4 + FEATURED_REGION_MAX_LEN * MAX_FEATURED_REGIONS;

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct FeaturedState {
    pub featured: Vec<FeaturedRegion>,
}

pub const FEATURED_REGION_MAX_LEN: usize = 0 +
    8 + // time_ms
    2 + // x
    2 + // y
    2 + // width
    2 + // height
    4 + MAX_FEATURED_CALLOUT_LEN + // callout
    4 + MAX_FEATURED_DOMAIN_LEN; // sol_domain

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct FeaturedRegion {
    /// Time that this region was featured in ms since epoch
    pub time_ms: u64,
    pub x: i16,
    pub y: i16,
    pub width: i16,
    pub height: i16,
    pub callout: String,

    // TODO(will): Whats the right way to incorporate sol domains?
    // Need to figure out how they work
    pub sol_domain: String,
}

// If you are changing this make sure to update TapestryPatch.ts as well

pub const MAX_X: i16 = 511;
pub const MIN_X: i16 = -512;
pub const MAX_Y: i16 = 511;
pub const MIN_Y: i16 = -512;
pub const CHUNK_SIZE: i16 = 8;

pub const MAX_PATCH_IMAGE_DATA_LEN: usize = 1024;
pub const MAX_PATCH_URL_LEN: usize = 128;
pub const MAX_PATCH_HOVER_TEXT_LEN: usize = 64;

pub const MAX_PATCH_TOTAL_LEN: usize = 0 + 
    1 + // is_initialized
    32 + // owned_by_mint
    1 + // x_chunk
    1 + // y_chunk
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

    /// local chunk x
    pub x_chunk: i8,

    /// local chunk y
    pub y_chunk: i8,

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

    assert_coords_valid(patch.x, patch.y)?;

    let ChunkCoords { x_chunk, y_chunk } = chunk_for_coords(patch.x, patch.y);

    if patch.x_chunk != x_chunk || patch.y_chunk != y_chunk {
        return Err(TapestryError::InvalidPatchChunkCoordinates.into());
    }

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

pub fn assert_featured_region_valid(region: &FeaturedRegion) -> ProgramResult {
    assert_coords_valid(region.x, region.y)?;
    assert_coords_valid(region.x + region.width, region.y + region.y)?;

    if region.callout.len() > MAX_FEATURED_CALLOUT_LEN {
        return Err(TapestryError::FeaturedCalloutTooLong.into());
    }

    if region.sol_domain.len() > MAX_FEATURED_DOMAIN_LEN {
        return Err(TapestryError::FeaturedSolDomainTooLong.into());
    }

    return Ok(())
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

pub fn find_featured_state_address(program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(&[
        TAPESTRY_PDA_PREFIX.as_bytes(),
        TAPESTRY_FEATURED_PDA_PREFIX.as_bytes(),
    ], program_id);
}