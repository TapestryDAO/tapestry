use crate::id;
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::pubkey::Pubkey;

//////////////////////////////////////////////////////////////////////////////////
////////////////////////////////// USER ACCOUNT //////////////////////////////////

/// PDA prefix for user accounts
pub const USER_ACCOUNT_PDA_PREFIX: &str = "acct";

pub const BASE_ACCOUNT_COST_LAMPORTS: u64 = 100_000_000;

#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone)]
pub struct UserAccount {
    // NOTE(will): Instead of a user account, this would become a mint pda
    pub owner: Pubkey,

    // Time this account last updated a pixel (ms since epoch)
    pub last_update_ms: u64,
}

//////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// PATCH ACCOUNT //////////////////////////////////

pub const PLACE_HEIGHT_PX: u16 = 1080;

pub const PLACE_WIDTH_PX: u16 = 1920;

// 1080 / 40 = 27
// 1920 / 40 = 48
// 27 * 48 = 1296
pub const PATCH_SIZE_PX: usize = 40;

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
pub const PATCH_DATA_LEN: usize = 0 + 1 + 1 + 4 + 1600;

/// In order to prevent a global write lock, i'll chunk the pixel into regions
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Patch {
    // x coordinate of the patch ULO
    pub x: u8,
    // y coordinate of the patch ULO
    pub y: u8,

    // NOTE(will): might be easier to store lines here

    // Pixels in row major order
    pub pixels: Vec<u8>,
}
