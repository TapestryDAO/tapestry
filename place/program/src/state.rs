use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{pubkey::Pubkey, account_info::AccountInfo, program_error::ProgramError, borsh::try_from_slice_unchecked,};
use crate::error::PlaceError;

// Identifies an Account type in the first byte of the account data
// Useful for queries
#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone, Copy)]
pub enum PlaceAccountType {
    Uninitialized,
    PlaceState,
    Patch,
    GameplayTokenMeta,
}

pub fn try_from_slice_checked<T: BorshDeserialize>(
    data: &[u8],
    data_type: PlaceAccountType,
    data_size: usize,
) -> Result<T, ProgramError> {
    if (data[0] != data_type as u8 && data[0] != PlaceAccountType::Uninitialized as u8)
        || data.len() != data_size
    {
        return Err(PlaceError::AccountDataTypeMismatch.into());
    }

    let result: T = try_from_slice_unchecked(data)?;

    Ok(result)
}

//////////////////////////////////////////////////////////////////////////////////
/////////////////////// GAMEPLAY TOKEN METADATA //////////////////////////////////

pub const DEFAULT_IS_FROZEN: bool = false;
pub const DEFAULT_PAINTBRUSH_PRICE: u64 = 2_000_000;    // units are lamports
pub const DEFAULT_PAINTBRUSH_COOLDOWN: u64 = 60 * 10;   // units are seconds
pub const DEFAULT_BOMB_PRICE: u64 = 500_000_000;        // units are lamports

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PlaceState {
    pub acct_type: PlaceAccountType,

    // The owner of the tapestry, unsure if there is a better way to handle this
    pub owner: Pubkey,

    // if the tapestry state has been frozen for NFT creation and auction
    pub is_frozen: bool,

    // Current price of a gameplay token of type Paintbrush
    pub paintbrush_price: u64,

    // number of seconds for the cooldown for new paintbrushes
    pub paintbrush_cooldown: u64,

    // current price of a gameplay token of type Bomb
    pub bomb_price: u64,
}

impl PlaceState {
    pub const LEN: usize = 0 +
        1 + // acct_type
        32 + // owner
        1 + // is_frozen
        8 + // paintbrush_price
        8 + // paintbrush_cooldown
        8; // bomb_price

    pub const PREFIX: &'static str = "place";

    pub fn from_account_info(a: &AccountInfo) -> Result<PlaceState, ProgramError> {
        let state: PlaceState =
            try_from_slice_checked(&a.data.borrow_mut(), PlaceAccountType::PlaceState, Self::LEN)?;

        Ok(state)
    }

    pub fn from_bytes(b: &[u8]) -> Result<PlaceState, ProgramError> {
        let state: PlaceState = try_from_slice_checked(b, PlaceAccountType::PlaceState, Self::LEN)?;
        Ok(state)
    }

    pub fn pda() -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[Self::PREFIX.as_bytes()],
            &crate::id(),
        )
    }
}

//////////////////////////////////////////////////////////////////////////////////
/////////////////////// GAMEPLAY TOKEN METADATA //////////////////////////////////

#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone, Copy)]
pub enum GameplayTokenType {
    PaintBrush,
    Bomb,
}

/// PDA prefix for user accounts
pub const GAMEPLAY_TOKEN_META_PREFIX: &str = "game";

/// Holds the metadata and relevant state for a gameplay token
#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone)]
pub struct GameplayTokenMeta {
    pub acct_type: PlaceAccountType,

    pub gameplay_type: GameplayTokenType,

    // I think this should be the slot rounded to some reasonable number
    // such that we can query in a time based way
    pub created_at_slot: u64,

    // 64 bit integer used as a seed for generating this pda
    pub random_seed: u64,
    
    // the token mint associated with this metadata
    pub token_mint_pda: Pubkey,

    // amount of time after an update which this token needs to cooldown
    pub cooldown_ms: u32,

    // wall clock time after which this gameplay token can be used for an update (ms since epoch)
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
