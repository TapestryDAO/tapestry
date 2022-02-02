use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

// Identifies an Account type in the first byte of the account data
// Useful for queries
#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone, Copy)]
pub enum PlaceAccountType {
    Patch,
    GameplayTokenMeta,
}

//////////////////////////////////////////////////////////////////////////////////
/////////////////////// GAMEPLAY TOKEN METADATA //////////////////////////////////

/// PDA prefix for user accounts
pub const GAMEPLAY_TOKEN_META_PREFIX: &str = "game";

pub const BASE_ACCOUNT_COST_LAMPORTS: u64 = 100_000_000;

/// Holds the metadata and relevant state for a gameplay token
#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone)]
pub struct GameplayTokenMeta {
    pub acct_type: PlaceAccountType,
    // NOTE(will): Instead of a user account, this would become a mint pda
    pub owner: Pubkey,

    // Time this account last updated a pixel (ms since epoch)
    pub update_allowed_after_ms: u64,
}

//////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// PATCH ACCOUNT //////////////////////////////////

pub const PLACE_HEIGHT_PX: u16 = 1000;
pub const PLACE_WIDTH_PX: u16 = 1000;
pub const PATCH_SIZE_PX: usize = 20;
pub const PATCH_PDA_PREFIX: &str = "patch";

pub fn find_address_for_patch(x: u8, y: u8, program_id: &Pubkey) -> (Pubkey, u8) {
    return Pubkey::find_program_address(
        &[
            PATCH_PDA_PREFIX.as_bytes(),
            &x.to_le_bytes(),
            &y.to_le_bytes(),
        ],
        program_id,
    );
}

/// Length of this
///
pub const PATCH_DATA_LEN: usize = 0 
    + 1 // acct_type
    + 1 // x
    + 1 // y
    + 4 // length of pixels
    + (PATCH_SIZE_PX * PATCH_SIZE_PX); // Pixels

/// In order to prevent a global write lock, i'll chunk the pixel into regions
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Patch {
    pub acct_type: PlaceAccountType,
    // x coordinate of the patch ULO
    pub x: u8,
    // y coordinate of the patch ULO
    pub y: u8,

    // NOTE(will): might be easier to store lines here

    // Pixels in row major order
    pub pixels: Vec<u8>,
}
