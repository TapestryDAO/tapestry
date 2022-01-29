use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum PlaceError {
    #[error("Invalid Instruction")]
    InvalidInstruction, // 0
}

impl From<PlaceError> for ProgramError {
    fn from(e: PlaceError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
