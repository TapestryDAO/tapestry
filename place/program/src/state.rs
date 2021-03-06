use std::thread::AccessError;

use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{pubkey::Pubkey, account_info::AccountInfo, program_error::ProgramError, borsh::try_from_slice_unchecked, clock::Slot,};
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
////////////////////////////// PLACE STATE ///////////////////////////////////////

pub const DEFAULT_IS_FROZEN: bool = false;
pub const DEFAULT_PAINTBRUSH_PRICE: u64 = 20_000_000;                   // units are lamports
pub const DEFAULT_PAINTBRUSH_COOLDOWN: Slot = (5 * 60 * 1000) / 400;    // units are slots 
pub const DEFAULT_BOMB_PRICE: u64 = 500_000_000;                        // units are lamports

#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct PlaceState {
    pub acct_type: PlaceAccountType,

    // The owner of the tapestry, unsure if there is a better way to handle this
    pub owner: Pubkey,

    // if the tapestry state has been frozen for NFT creation and auction
    pub is_frozen: bool,

    // Current price of a gameplay token of type Paintbrush
    pub paintbrush_price: u64,

    // number of slots for the cooldown for new paintbrushes
    pub paintbrush_cooldown: Slot,

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
    pub const TOKEN_MINT_PREFIX: &'static str = "tokes";

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

    pub fn token_mint_pda() -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                Self::PREFIX.as_bytes(),
                Self::TOKEN_MINT_PREFIX.as_bytes(),
            ],
            &crate::id(),
        )
    }

    pub fn token_mint_mpl_metadata_pda() -> (Pubkey, u8) {
        let (token_mint_pda, _) = Self::token_mint_pda();
        mpl_token_metadata::pda::find_metadata_account(&token_mint_pda)
    }
}

//////////////////////////////////////////////////////////////////////////////////
/////////////////////// GAMEPLAY TOKEN METADATA //////////////////////////////////

#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone, Copy)]
pub enum GameplayTokenType {
    PaintBrush,
    Bomb,
}

/// Holds the metadata and relevant state for a gameplay token
#[derive(BorshDeserialize, BorshSerialize, PartialEq, Debug, Clone)]
pub struct GameplayTokenMeta {
    pub acct_type: PlaceAccountType,

    pub gameplay_type: GameplayTokenType,

    // I think this should be the slot rounded to some reasonable number
    // such that we can query in a time based way
    pub created_at_slot: Slot,

    // 64 bit integer used as a seed for generating this pda
    pub random_seed: u64,
    
    // the token mint associated with this metadata
    pub token_mint_pda: Pubkey,

    // update allowed slot 
    pub update_allowed_slot: Slot,

    // number of slots for the cooldown of this token
    pub cooldown_duration: Slot,

    // Number of place tokens due to be paid out to the owner of this gameplay token
    // NOTE(will): in order to avoid a global write lock on the place token mint
    // within the SetPixel instruction, we increment this number instead.
    // user's can later claim their tokens in a separate transaction.
    pub place_tokens_owed: u32,
}

impl GameplayTokenMeta {
    pub const PREFIX: &'static str = "game";
    pub const MINT_PREFIX: &'static str = "mint";

    pub const LEN: usize = 0 + 
        1 + // acct_type
        1 + // gameplay_type
        8 + // created_at_slot
        8 + // random_seed
        32 + // token_mint_pda
        8 +  // update_allowed_after
        8 +  // cooldown_duration
        4; // place_tokens_owed

    pub fn from_account_info(a: &AccountInfo) -> Result<GameplayTokenMeta, ProgramError> {
        let state: GameplayTokenMeta =
            try_from_slice_checked(&a.data.borrow_mut(), PlaceAccountType::GameplayTokenMeta, Self::LEN)?;

        Ok(state)
    }

    pub fn from_bytes(b: &[u8]) -> Result<GameplayTokenMeta, ProgramError> {
        let state: GameplayTokenMeta = try_from_slice_checked(b, PlaceAccountType::GameplayTokenMeta, Self::LEN)?;
        Ok(state)
    }

    pub fn pda(random_seed: u64) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                Self::PREFIX.as_bytes(),
                &random_seed.to_le_bytes(),
            ],
            &crate::id(),
        )
    }

    pub fn pda_for_instance(&self) -> (Pubkey, u8) {
        return Self::pda(self.random_seed);
    }
    
    pub fn token_mint_pda(random_seed: u64) -> (Pubkey, u8) {
        return Pubkey::find_program_address(
            &[
                Self::PREFIX.as_bytes(),
                &random_seed.to_le_bytes(),
                Self::MINT_PREFIX.as_bytes(),
            ],
            &crate::id(),
        )
    }

    pub fn token_metadata_pda(random_seed: u64) -> (Pubkey, u8) {
        let (mint_pda, _) = Self::token_mint_pda(random_seed);
        let mpl_token_meta_prog_id = mpl_token_metadata::id();
        // mpl_token_metadata::pda::find_metadata_account(mint)
        return Pubkey::find_program_address(
            &[
                mpl_token_metadata::state::PREFIX.as_bytes(),
                mpl_token_meta_prog_id.as_ref(),
                mint_pda.as_ref(),
            ],
            &mpl_token_meta_prog_id,
        );
    }
}

//////////////////////////////////////////////////////////////////////////////////
///////////////////////////////// PATCH ACCOUNT //////////////////////////////////

// TODO(will): move these into impl to make this more classy
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

    // Pixels in row major order
    pub pixels: Vec<u8>,
}

impl Patch {
    pub const PREFIX: &'static str = "patch";

    pub const LEN: usize = 0 
        + 1 // acct_type
        + 1 // x
        + 1 // y
        + 4 // length of pixels
        + (PATCH_SIZE_PX * PATCH_SIZE_PX); // Pixels

    pub fn from_account_info(a: &AccountInfo) -> Result<Patch, ProgramError> {
        let patch: Patch =
            try_from_slice_checked(&a.data.borrow_mut(), PlaceAccountType::Patch, Self::LEN)?;
        return Ok(patch);
    }

    pub fn from_bytes(b: &[u8]) -> Result<Patch, ProgramError> {
        let patch: Patch = try_from_slice_checked(b, PlaceAccountType::Patch, Self::LEN)?;
        Ok(patch)
    }

    pub fn pda(x: u8, y: u8) -> (Pubkey, u8) {
        return Pubkey::find_program_address(
            &[
                Self::PREFIX.as_bytes(),
                &x.to_le_bytes(),
                &y.to_le_bytes(),
            ],
            &crate::id(),
        );
    }

    pub fn pda_for_instance(&self) -> (Pubkey, u8) {
        return Self::pda(self.x, self.y);
    }
}
