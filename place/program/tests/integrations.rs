use solana_program::program_error::ProgramError;

use solana_program_test::{processor, tokio, ProgramTest, ProgramTestContext};
use solana_sdk::{signature::Keypair, signature::Signer, transaction::Transaction};
use assert_matches::assert_matches;
use solana_place::state::find_address_for_patch;

#[tokio::test]
async fn test_purchase_account() {
    // let program_id = Pubkey::new_unique();
    let program_id = solana_place::id();
    let mut pt = ProgramTest::new(
        "solana_place",
        program_id,
        processor!(solana_place::entrypoint::process_instruction),
    );

    let mut pt_ctx = pt.start_with_context().await;

    let mut banks_client = pt_ctx.banks_client;
    let payer = pt_ctx.payer;
    let recent_blockhash = pt_ctx.last_blockhash;
    let x = 0u8;
    let y = 0u8;
    let x_offset = 0u8;
    let y_offset = 0u8; 

    let pixel: [u8; 3] = [0, 0, 0];

    let (patch_pda, _) = find_address_for_patch(x, y, &program_id);

    let set_pixel_ix = solana_place::instruction::get_ix_set_pixel(
        solana_place::id(),
        payer.pubkey(),
        x, y, x_offset, y_offset, pixel,
    );

    let set_pixel_tx = Transaction::new_signed_with_payer(
        &[set_pixel_ix],
        Some(&payer.pubkey()),
        &[&payer,],
        recent_blockhash,
    );

    let set_pixel_result = banks_client.process_transaction(set_pixel_tx).await;
    assert_matches!(set_pixel_result, Ok(()));

}