
// Declare the program ID

#[cfg(feature = "mainnet")]
pub const BASE_URL: &'static str = "https://tapestry.art";

#[cfg(feature = "devent")]
pub const BASE_URL: &'static str = "https://dev.tapestry.art";

#[cfg(all(not(feature = "devnet"), not(feature = "mainnet")))]
pub const BASE_URL: &'static str = "http://localhost:8080";