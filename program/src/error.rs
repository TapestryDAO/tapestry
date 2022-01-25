use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum TapestryError {
    /// Failed to parse instruction
    #[error("Invalid Instruction")]
    InvalidInstruction, // 0

    #[error("Required account is not rent exempt")]
    NotRentExempt, // 1

    #[error("Account had incorrect owner")]
    IncorrectOwner, // 2

    #[error("Invalid tapestry state pda account")]
    InvalidTapestryStatePDA, // 3

    #[error("Tapestry patch account did not match the coordinates")]
    InvalidTapestryPatchPDA, // 4

    #[error("Tapestry patch account has already been allocated (already sold)")]
    TapestryPatchAlreadySold, // 5

    #[error("Invalid mint account pda for the provided patch")]
    InvalidTapestryPatchMintPDA, // 6

    #[error("The associated token account to hold the patch NFT is invalid")]
    InvalidTapestryPatchAssociatedTokenAccount, // 7

    #[error("The buyer account did not have enough lamports to purcahse a patch")]
    InsufficientFundsForPurchase, // 8

    #[error("The url for the patch is too long (in bytes)")]
    PatchURLTooLong, // 9

    #[error("The hover text for the patch is too long (in bytes)")]
    PatchHoverTextTooLong, // 10

    #[error("The image data for the patch is too long (in bytes)")]
    PatchImageDataTooLong, // 11

    #[error("The token account was not valid")]
    InvalidPatchTokenAccount, // 12

    #[error("Unexpected Patch State")]
    UnexpectedPatchState, // 13

    #[error("Invalid Patch Coordinates")]
    InvalidPatchCoordinates, // 14

    #[error("Invalid Patch Chunk Coordinates")]
    InvalidPatchChunkCoordinates, // 15

    #[error("Patch account not allocated (has no data)")]
    PatchAccountNotAllocated, // 16

    #[error("Patch account is not owned by mint address provided")]
    PatchAccountNotOwnedByMint, // 17

    #[error("Featured account is incorrect or already allocated")]
    InvalidTapestryFeaturedPDA, // 18
}

impl From<TapestryError> for ProgramError {
    fn from(e: TapestryError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
