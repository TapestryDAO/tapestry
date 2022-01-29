use solana_program::{borsh::try_from_slice_unchecked, program_error::ProgramError};

use assert_matches::assert_matches;
use solana_place::state::find_address_for_patch;
use solana_program_test::{processor, tokio, ProgramTest, ProgramTestContext};
use solana_sdk::{signature::Keypair, signature::Signer, transaction::Transaction};

use solana_place::state::{Patch, PATCH_SIZE_PX, PIXEL_SIZE_BYTES};

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
        x,
        y,
        x_offset,
        y_offset,
        pixel,
    );

    let set_pixel_tx = Transaction::new_signed_with_payer(
        &[set_pixel_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let set_pixel_result = banks_client.process_transaction(set_pixel_tx).await;
    assert_matches!(set_pixel_result, Ok(()));

    {
        let rent = banks_client.get_rent().await.unwrap();

        let patch_acct = banks_client.get_account(patch_pda).await.unwrap().unwrap();

        let expected_balance = rent.minimum_balance(patch_acct.data.len());
        assert_eq!(patch_acct.lamports, expected_balance);

        let patch: Patch = try_from_slice_unchecked(&patch_acct.data).unwrap();

        for y in 0..PATCH_SIZE_PX {
            for x in 0..PATCH_SIZE_PX {
                let num_pixels = y * PATCH_SIZE_PX + x;
                let idx = num_pixels * PIXEL_SIZE_BYTES;
                if x_offset == x as u8 && y_offset == y as u8 {
                    assert_eq!(0, patch.pixels[idx]);
                    assert_eq!(0, patch.pixels[idx + 1]);
                    assert_eq!(0, patch.pixels[idx + 2]);
                } else {
                    assert_eq!(255, patch.pixels[idx]);
                    assert_eq!(255, patch.pixels[idx + 1]);
                    assert_eq!(255, patch.pixels[idx + 2]);
                }
            }
        }
    }
}
