use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum PlaceError {
    #[error("Invalid Instruction")]
    InvalidInstruction, // 0

    #[error("Incorrect patch pda")]
    IncorrectPatchPDA, // 1

    #[error("Invalid Patch coordiantes")]
    InvalidPatchCoordinates, // 2

    #[error("Patch account already Initialized")]
    PatchAccountAlreadyInitialized, // 3

    #[error("Account data did not match expected type")]
    AccountDataTypeMismatch, // 4

    #[error("Incorrect Place State PDA account")]
    IncorrectPlaceStatePDA, // 5

    #[error("Invalid account argument")]
    InvalidAccountArgument, // 6

    #[error("Invalid owner")]
    InvalidOwner, // 6

    #[error("Invalid gameplay token meta pda")]
    IncorrectGameplayTokenMetaPDA, // 7

    #[error("Gameplay Token already purchased")]
    GameplayTokenAlreadyPurchased, // 8

    #[error("Incorrect gameplay token mint pda")]
    InvalidGameplayTokenMintPDA, // 9

    #[error("Desired price different from current price")]
    DesiredPriceDifferentFromCurrentPrice, // 10
}

impl From<PlaceError> for ProgramError {
    fn from(e: PlaceError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
