use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum TapestryError {
    /// Failed to parse instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,

    #[error("Required account is not rent exempt")]
    NotRentExempt,

    #[error("Account had incorrect owner")]
    IncorrectOwner,

    #[error("Invalid tapestry state pda account")]
    InvalidTapestryStatePDA,

    #[error("Tapestry patch account did not match the coordinates")]
    InvalidTapestryPatchPDA,

    #[error("Tapestry patch account has already been allocated (already sold)")]
    TapestryPatchAlreadySold,

    #[error("Invalid mint account pda for the provided patch")]
    InvalidTapestryPatchMintPDA,

    #[error("The associated token account to hold the patch NFT is invalid")]
    InvalidTapestryPatchAssociatedTokenAccount,

    #[error("The buyer account did not have enough lamports to purcahse a patch")]
    InsufficientFundsForPurchase,

    #[error("The url for the patch is too long (in bytes)")]
    PatchURLTooLong,

    #[error("The hover text for the patch is too long (in bytes)")]
    PatchHoverTextTooLong,

    #[error("The image data for the patch is too long (in bytes)")]
    PatchImageDataTooLong,

    #[error("The token account was not valid")]
    InvalidPatchTokenAccount,

    #[error("Unexpected Patch State")]
    UnexpectedPatchState,
}

impl From<TapestryError> for ProgramError {
    fn from(e: TapestryError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
