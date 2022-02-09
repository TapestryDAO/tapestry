use solana_program::instruction::InstructionError;
use solana_program::{
    borsh::try_from_slice_unchecked, program_error::ProgramError, system_instruction,
};

use assert_matches::assert_matches;
use solana_place::state::{find_address_for_patch, GameplayTokenMeta};
use solana_program_test::{processor, tokio, ProgramTest, ProgramTestContext};
use solana_sdk::account::ReadableAccount;
use solana_sdk::transaction::TransactionError;
use solana_sdk::{
    commitment_config::CommitmentLevel, signature::Keypair, signature::Signer,
    transaction::Transaction, transport::TransportError,
};

use solana_place::instruction;
use solana_place::state::{GameplayTokenType, Patch, PlaceAccountType, PlaceState, PATCH_SIZE_PX};

#[tokio::test]
async fn test_all_the_things() {
    // let program_id = Pubkey::new_unique();
    let program_id = solana_place::id();
    let mut pt = ProgramTest::new(
        "solana_place",
        program_id,
        processor!(solana_place::entrypoint::process_instruction),
    );

    pt.add_program("mpl_token_metadata", mpl_token_metadata::id(), None);

    let mut pt_ctx = pt.start_with_context().await;

    let mut banks_client = pt_ctx.banks_client;
    let payer = pt_ctx.payer;
    let recent_blockhash = pt_ctx.last_blockhash;

    let game_player = Keypair::new();
    let fund_game_player_ix =
        system_instruction::transfer(&payer.pubkey(), &game_player.pubkey(), 10_000_000_000);

    let fund_game_player_tx = Transaction::new_signed_with_payer(
        &[fund_game_player_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    assert_matches!(
        banks_client.process_transaction(fund_game_player_tx).await,
        Ok(())
    );

    // Initialize the place state account

    let update_place_ix = instruction::get_ix_update_place_state(
        payer.pubkey(),
        Some(payer.pubkey()),
        Some(false),
        None,
        None,
        None,
    );

    let update_place_tx = Transaction::new_signed_with_payer(
        &[update_place_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let update_place_result = banks_client.process_transaction(update_place_tx).await;
    assert_matches!(update_place_result, Ok(()));

    {
        // Check update results
        let (place_state_pda, _) = PlaceState::pda();
        let place_state_acct = banks_client
            .get_account(place_state_pda)
            .await
            .unwrap()
            .unwrap();

        let state = PlaceState::from_bytes(&place_state_acct.data).unwrap();
        assert_eq!(state.acct_type, PlaceAccountType::PlaceState);
        assert_eq!(state.owner, payer.pubkey());
        assert_eq!(state.is_frozen, false);
        assert_eq!(
            state.paintbrush_price,
            solana_place::state::DEFAULT_PAINTBRUSH_PRICE
        );
        assert_eq!(
            state.paintbrush_cooldown,
            solana_place::state::DEFAULT_PAINTBRUSH_COOLDOWN
        );
        assert_eq!(state.bomb_price, solana_place::state::DEFAULT_BOMB_PRICE);
    }

    // update the place state account

    let new_paintbrush_price = solana_place::state::DEFAULT_PAINTBRUSH_PRICE + 1;
    let new_paintbrush_cooldown = solana_place::state::DEFAULT_PAINTBRUSH_COOLDOWN + 1;
    let new_bomb_price = solana_place::state::DEFAULT_BOMB_PRICE + 1;

    let update_place_ix2 = instruction::get_ix_update_place_state(
        payer.pubkey(),
        None,
        None,
        Some(new_paintbrush_price),
        Some(new_paintbrush_cooldown),
        Some(new_bomb_price),
    );

    let update_place_tx2 = Transaction::new_signed_with_payer(
        &[update_place_ix2],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let update_place_result2 = banks_client.process_transaction(update_place_tx2).await;
    assert_matches!(update_place_result2, Ok(()));

    {
        // Check update results
        let (place_state_pda, _) = PlaceState::pda();
        let place_state_acct = banks_client
            .get_account(place_state_pda)
            .await
            .unwrap()
            .unwrap();

        let state = PlaceState::from_bytes(&place_state_acct.data).unwrap();
        assert_eq!(state.acct_type, PlaceAccountType::PlaceState);
        assert_eq!(state.owner, payer.pubkey());
        assert_eq!(state.is_frozen, false);
        assert_eq!(state.paintbrush_price, new_paintbrush_price);
        assert_eq!(state.paintbrush_cooldown, new_paintbrush_cooldown);
        assert_eq!(state.bomb_price, new_bomb_price);
    }

    // initialize the token mint

    let init_mint_ix = instruction::get_ix_init_mint(payer.pubkey());
    let init_mint_tx = Transaction::new_signed_with_payer(
        &[init_mint_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let init_mint_result = banks_client.process_transaction(init_mint_tx).await;

    assert_matches!(init_mint_result, Ok(()));

    let (recent_blockhash2, _) = banks_client
        .get_latest_blockhash_with_commitment(CommitmentLevel::Confirmed)
        .await
        .unwrap()
        .unwrap();

    let init_mint_ix2 = instruction::get_ix_init_mint(payer.pubkey());
    let init_mint_tx2 = Transaction::new_signed_with_payer(
        &[init_mint_ix2],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash2,
    );

    let init_mint_result2 = banks_client.process_transaction(init_mint_tx2).await;

    let expected_mint_failure =
        TransportError::TransactionError(TransactionError::InstructionError(
            0,
            InstructionError::Custom(18), // PlaceTokenMintAlreadyInitialized
        ));

    assert_matches!(init_mint_result2, expected_mint_failure);

    // purchase a gameplay token

    let random_seed: u64 = 10101;

    let purchase_gameplay_token_ix = instruction::get_ix_purchase_gameplay_token(
        game_player.pubkey(),
        random_seed,
        GameplayTokenType::PaintBrush,
        new_paintbrush_price,
    );

    let purchase_gameplay_token_tx = Transaction::new_signed_with_payer(
        &[purchase_gameplay_token_ix],
        Some(&game_player.pubkey()),
        &[&game_player],
        recent_blockhash,
    );

    let game_player_balance_before = banks_client
        .get_balance(game_player.pubkey())
        .await
        .unwrap();

    let purchase_gameplay_token_result = banks_client
        .process_transaction_with_commitment(purchase_gameplay_token_tx, CommitmentLevel::Confirmed)
        .await;

    assert_matches!(purchase_gameplay_token_result, Ok(()));

    let game_player_balance_after = banks_client
        .get_balance(game_player.pubkey())
        .await
        .unwrap();

    let total_balance_change = game_player_balance_before
        .checked_sub(game_player_balance_after)
        .unwrap();

    println!("Balance Change: {}", total_balance_change);

    let total_rent = total_balance_change - new_paintbrush_price;

    println!("Total rent was: {}", total_rent);
    // assert_eq!(total_rent, 1);

    let (gameplay_token_pda, _) = GameplayTokenMeta::pda(random_seed);
    let gameplay_token_acct: GameplayTokenMeta = banks_client
        .get_account_data_with_borsh(gameplay_token_pda)
        .await
        .unwrap();

    let current_slot = banks_client.get_root_slot().await.unwrap();

    // TODO(will): check token mint and ata were correctly set up
    assert_eq!(
        gameplay_token_acct.acct_type,
        PlaceAccountType::GameplayTokenMeta
    );
    assert_eq!(gameplay_token_acct.created_at_slot, current_slot);
    assert_eq!(gameplay_token_acct.random_seed, random_seed);
    assert_eq!(gameplay_token_acct.update_allowed_slot, current_slot);
    assert_eq!(
        gameplay_token_acct.cooldown_duration,
        new_paintbrush_cooldown
    );
    println!("cooldown: {}", new_paintbrush_cooldown);
    assert_eq!(gameplay_token_acct.update_allowed_slot, current_slot);

    let game_player_ata = spl_associated_token_account::get_associated_token_address(
        &game_player.pubkey(),
        &gameplay_token_acct.token_mint_pda,
    );

    // assert_eq(gameplay_token_acct.update_allowed_slot,)

    // initialize the patch (allocate data)

    let x = 0u8;
    let y = 0u8;
    let x_offset = 0u8;
    let y_offset = 0u8;

    let pixel: u8 = 0b10101010;

    let (patch_pda, _) = find_address_for_patch(x, y, &program_id);

    let init_patch_ix =
        solana_place::instruction::get_ix_init_patch(solana_place::id(), payer.pubkey(), x, y);

    let init_patch_tx = Transaction::new_signed_with_payer(
        &[init_patch_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    let init_patch_result = banks_client.process_transaction(init_patch_tx).await;
    assert_matches!(init_patch_result, Ok(()));

    // Attempt to set a pixel

    println!("Setting Pixel");

    let set_pixel_ix = solana_place::instruction::get_ix_set_pixel(
        solana_place::id(),
        game_player.pubkey(),
        gameplay_token_pda,
        game_player_ata,
        x,
        y,
        x_offset,
        y_offset,
        pixel,
    );

    let set_pixel_tx = Transaction::new_signed_with_payer(
        &[set_pixel_ix],
        Some(&game_player.pubkey()),
        &[&game_player],
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

        // iterate over patches
        for y in 0..PATCH_SIZE_PX {
            for x in 0..PATCH_SIZE_PX {
                let idx = y * PATCH_SIZE_PX + x;
                if x_offset == x as u8 && y_offset == y as u8 {
                    assert_eq!(pixel, patch.pixels[idx])
                } else {
                    assert_eq!(0 as u8, patch.pixels[idx]);
                }
            }
        }
    }

    let (recent_blockhash2, _) = banks_client
        .get_latest_blockhash_with_commitment(CommitmentLevel::Confirmed)
        .await
        .unwrap()
        .unwrap();

    // Attempt to set another pixel, but should fail because of cooldown
    let set_pixel_ix2 = solana_place::instruction::get_ix_set_pixel(
        solana_place::id(),
        game_player.pubkey(),
        gameplay_token_pda,
        game_player_ata,
        x,
        y,
        x_offset,
        y_offset,
        pixel,
    );

    let set_pixel_tx2 = Transaction::new_signed_with_payer(
        &[set_pixel_ix2],
        Some(&game_player.pubkey()),
        &[&game_player],
        recent_blockhash2,
    );

    // let set_pixel_result2 = banks_client.process_transaction(set_pixel_tx2).await;
    let set_pixel_result2 = banks_client
        .process_transaction_with_commitment(set_pixel_tx2, CommitmentLevel::Confirmed)
        .await;
    // let expected_result = TransactionError(solana_place::error::PlaceError::GameplayTokenNotReady.into());
    let expected_result = TransportError::TransactionError(TransactionError::InstructionError(
        0,
        InstructionError::Custom(12),
    ));

    assert_matches!(set_pixel_result2, Err(expected_result));
}
