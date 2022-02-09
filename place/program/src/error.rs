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
    InvalidOwner, // 7

    #[error("Invalid gameplay token meta pda")]
    IncorrectGameplayTokenMetaPDA, // 8

    #[error("Gameplay Token already purchased")]
    GameplayTokenAlreadyPurchased, // 9

    #[error("Incorrect gameplay token mint pda")]
    InvalidGameplayTokenMintPDA, // 10

    #[error("Desired price different from current price")]
    DesiredPriceDifferentFromCurrentPrice, // 11

    #[error("Gameplay token not cooled down")]
    GameplayTokenNotReady, // 12

    #[error("Invalid Gameplay token ATA")]
    InvalidGameplayTokenATA, // 13

    #[error("Invalid Gameplay token owner")]
    InvalidGameplayTokenAccountOwner, // 14

    #[error("Invalid Gameplay token balance")]
    InvalidGameplayTokenAccountBalance, // 15

    #[error("Invalid Gameplay token balance")]
    InvalidGameplayTokenAccountMint, // 16

    #[error("Invalid Place Token Mint PDA")]
    InvalidPlaceTokenMintPDA, // 17

    #[error("Place token mint already exists")]
    PlaceTokenMintAlreadyInitialized, // 18

    #[error("Invalid system program account")]
    InvalidSystemProgramAccount, // 19

    #[error("Invalid token program account")]
    InvalidTokenProgramAccount, // 20
}

impl From<PlaceError> for ProgramError {
    fn from(e: PlaceError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
