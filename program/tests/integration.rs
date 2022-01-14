use solana_program::program_pack::Pack;
use solana_tapestry::{
    error::TapestryError,
    state::{
        find_mint_address_for_patch_coords, find_patch_address_for_patch_coords,
        MAX_PATCH_HOVER_TEXT_LEN, MAX_PATCH_IMAGE_DATA_LEN, MAX_PATCH_URL_LEN,
    },
};

use {
    assert_matches::assert_matches,
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        borsh::try_from_slice_unchecked, entrypoint::ProgramResult, program_option::COption,
        pubkey::Pubkey, system_instruction,
    },
    solana_program_test::{processor, tokio, ProgramTest},
    solana_sdk::{signature::Keypair, signature::Signer, transaction::Transaction},
    solana_tapestry::{
        entrypoint::process_instruction,
        instruction::{
            get_ix_init_tapestry, get_ix_purchase_patch, get_ix_update_patch_image,
            get_ix_update_patch_metadata,
        },
        state::{
            assert_patch_is_valid, find_tapestry_state_address, TapestryPatch, TapestryState,
            CHUNK_SIZE, MAX_PATCH_TOTAL_LEN, MAX_X, MAX_Y, MIN_X, MIN_Y,
        },
        utils::{chunk_for_coords, ChunkCoords},
    },
    spl_token::state::{Account as TokenAccount, AccountState},
    std::str::FromStr,
};

pub fn get_string(len: usize) -> String {
    // NOTE(will): tried to make this random but was having issues
    // random package might not be available?
    return std::iter::repeat("X").take(len).collect::<String>();
}

#[tokio::test]
async fn test_patches() {
    let empty_patch = TapestryPatch {
        is_initialized: true,
        owned_by_mint: Pubkey::new_unique(),
        x_chunk: 0,
        y_chunk: 0,
        x: 0,
        y: 0,
        url: None,
        hover_text: None,
        image_data: None,
    };

    assert_patch_is_valid(&empty_patch).unwrap();

    let fully_loaded_patch = TapestryPatch {
        is_initialized: true,
        owned_by_mint: Pubkey::new_unique(),
        x_chunk: 0,
        y_chunk: 0,
        x: 0,
        y: 0,
        url: Some(get_string(MAX_PATCH_URL_LEN)),
        hover_text: Some(get_string(MAX_PATCH_HOVER_TEXT_LEN)),
        image_data: Some(get_string(MAX_PATCH_IMAGE_DATA_LEN).into_bytes()),
    };

    assert_patch_is_valid(&fully_loaded_patch).unwrap();

    let fully_loaded_serialized = fully_loaded_patch.try_to_vec().unwrap();

    assert_eq!(fully_loaded_serialized.len(), MAX_PATCH_TOTAL_LEN);

    let overloaded_patch = TapestryPatch {
        is_initialized: true,
        owned_by_mint: Pubkey::new_unique(),
        x_chunk: 0,
        y_chunk: 0,
        x: 0,
        y: 0,
        url: Some(get_string(MAX_PATCH_URL_LEN + 1)),
        hover_text: Some(get_string(MAX_PATCH_HOVER_TEXT_LEN)),
        image_data: Some(get_string(MAX_PATCH_IMAGE_DATA_LEN).into_bytes()),
    };

    let overload_result = assert_patch_is_valid(&overloaded_patch);

    assert_eq!(Err(TapestryError::PatchURLTooLong.into()), overload_result);

    let wrong_chunk_patch = TapestryPatch {
        is_initialized: true,
        owned_by_mint: Pubkey::new_unique(),
        x_chunk: 0,
        y_chunk: 0,
        x: -1,
        y: -1,
        url: Some(get_string(MAX_PATCH_URL_LEN)),
        hover_text: Some(get_string(MAX_PATCH_HOVER_TEXT_LEN)),
        image_data: Some(get_string(MAX_PATCH_IMAGE_DATA_LEN).into_bytes()),
    };

    let wrong_chunk_result = assert_patch_is_valid(&wrong_chunk_patch);

    assert_eq!(
        Err(TapestryError::InvalidPatchChunkCoordinates.into()),
        wrong_chunk_result
    );
}

#[tokio::test]
async fn test_chunks() {
    println!("asdf");
    let my_max = 127i16;
    assert_eq!(my_max as i8, std::i8::MAX);
    let my_min = -128i16;
    assert_eq!(my_min as i8, std::i8::MIN);

    assert_matches!(
        chunk_for_coords(0, 0),
        ChunkCoords {
            x_chunk: 0,
            y_chunk: 0,
        }
    );

    assert_matches!(
        chunk_for_coords(-1, 0),
        ChunkCoords {
            x_chunk: -1,
            y_chunk: 0,
        }
    );

    assert_matches!(
        chunk_for_coords(-1, -1),
        ChunkCoords {
            x_chunk: -1,
            y_chunk: -1,
        }
    );

    assert_matches!(
        chunk_for_coords(0, -1),
        ChunkCoords {
            x_chunk: 0,
            y_chunk: -1
        }
    );

    assert_matches!(
        chunk_for_coords(MAX_X, MAX_Y),
        ChunkCoords {
            x_chunk: 127,
            y_chunk: 127,
        }
    );

    assert_matches!(
        chunk_for_coords(MIN_X, MIN_Y),
        ChunkCoords {
            x_chunk: -128,
            y_chunk: -128,
        }
    );

    assert_matches!(
        chunk_for_coords(MIN_X, MAX_Y),
        ChunkCoords {
            x_chunk: -128,
            y_chunk: 127,
        }
    );

    assert_matches!(
        chunk_for_coords(MAX_X, MIN_Y),
        ChunkCoords {
            x_chunk: 127,
            y_chunk: -128,
        }
    );
}

#[tokio::test]
async fn test_pdas() {
    let buyer = Pubkey::from_str("6CormEz9nDRhYF7KBzg12Lo5PAMuBqzMpWzWcBZUGaxw").unwrap();
    let (state_pda, _) = find_tapestry_state_address(&solana_tapestry::id());
    let (patch_pda, _) = find_patch_address_for_patch_coords(1, 1, &solana_tapestry::id());
    let (mint_pda, _) = find_mint_address_for_patch_coords(1, 1, &solana_tapestry::id());
    let ata = spl_associated_token_account::get_associated_token_address(&buyer, &mint_pda);
    assert_eq!(
        state_pda,
        Pubkey::from_str("vjbpN6ehP3KnnyGtAffXepDnWWUGYEBThLoWQT7EkQX").unwrap()
    );
    assert_eq!(
        patch_pda,
        Pubkey::from_str("Gyb6f9U8GG8FjznsyEpSJEh16PFtF5eFquHbosBvc3oU").unwrap()
    );
    assert_eq!(
        mint_pda,
        Pubkey::from_str("B7m2nWL2i8MpJV579TBvtBqUY4hgDWvej1kAnmTLBtuK").unwrap()
    );
    assert_eq!(
        ata,
        Pubkey::from_str("6LVw7wSBzLiTMGhpExrc2igbpZyhpvLWdvjHjfEWUgfP").unwrap()
    )
}

#[tokio::test]
async fn test_init_tapestry_instruction() {
    // let program_id = Pubkey::new_unique();
    let program_id = solana_tapestry::id();
    let pt = ProgramTest::new(
        "solana_tapestry",
        program_id,
        processor!(process_instruction),
    );

    let (mut banks_client, payer, recent_blockhash) = pt.start().await;
    let initial_sale_price = 10_000_000u64;
    let init_tapestry_ix = get_ix_init_tapestry(program_id, payer.pubkey(), initial_sale_price);

    let init_tapestry_tx = Transaction::new_signed_with_payer(
        &[init_tapestry_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    assert_matches!(
        banks_client.process_transaction(init_tapestry_tx).await,
        Ok(())
    );

    // Check that balances and state are as we expect

    let (tapestry_state_key, _) = find_tapestry_state_address(&program_id);

    {
        let rent = banks_client.get_rent().await.unwrap();

        let tapestry_state_acct = banks_client
            .get_account(tapestry_state_key)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(
            tapestry_state_acct.lamports,
            rent.minimum_balance(tapestry_state_acct.data.len())
        );

        let tapestry_state: TapestryState =
            try_from_slice_unchecked(&tapestry_state_acct.data).unwrap();

        assert_eq!(tapestry_state.initial_sale_price, initial_sale_price);
    }

    // send some SOL to a new keypair, this account will buy a patch

    let buyer = Keypair::new();
    let fund_buyer_ix =
        system_instruction::transfer(&payer.pubkey(), &buyer.pubkey(), 10_000_000_000);

    let fund_buyer_tx = Transaction::new_signed_with_payer(
        &[fund_buyer_ix],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    assert_matches!(
        banks_client.process_transaction(fund_buyer_tx).await,
        Ok(())
    );

    // Purchase a patch with the buyer acct

    let patch_x = 100;
    let patch_y = -100;

    let purchase_patch_ix = get_ix_purchase_patch(program_id, buyer.pubkey(), patch_x, patch_y);
    let purchase_patch_tx = Transaction::new_signed_with_payer(
        &[purchase_patch_ix],
        Some(&buyer.pubkey()),
        &[&buyer],
        recent_blockhash,
    );

    println!("Executing purchase...");
    let purchase_result = banks_client.process_transaction(purchase_patch_tx).await;
    assert_matches!(purchase_result, Ok(()));

    let (tapestry_patch_key, _) =
        find_patch_address_for_patch_coords(patch_x, patch_y, &program_id);
    let (tapestry_patch_mint_key, _) =
        find_mint_address_for_patch_coords(patch_x, patch_y, &program_id);

    {
        let rent = banks_client.get_rent().await.unwrap();

        let tapestry_state_acct = banks_client
            .get_account(tapestry_state_key)
            .await
            .unwrap()
            .unwrap();

        let tapestry_patch_acct = banks_client
            .get_account(tapestry_patch_key)
            .await
            .unwrap()
            .unwrap();

        let expected_balance =
            rent.minimum_balance(tapestry_state_acct.data.len()) + initial_sale_price;
        assert_eq!(tapestry_state_acct.lamports, expected_balance);

        let tapestry_patch: TapestryPatch =
            try_from_slice_unchecked(&tapestry_patch_acct.data).unwrap();

        assert_eq!(tapestry_patch.is_initialized, true);
        assert_eq!(tapestry_patch.x, patch_x);
        assert_eq!(tapestry_patch.y, patch_y);
        assert_eq!(tapestry_patch.owned_by_mint, tapestry_patch_mint_key);
        assert_eq!(tapestry_patch.url, None);
        assert_eq!(tapestry_patch.hover_text, None);
        assert_eq!(tapestry_patch.image_data, None);

        let ata = spl_associated_token_account::get_associated_token_address(
            &buyer.pubkey(),
            &tapestry_patch_mint_key,
        );

        let buyer_token_acct = banks_client.get_account(ata).await.unwrap().unwrap();
        assert_eq!(buyer_token_acct.owner, spl_token::id());

        let buyer_token_acct_parsed = TokenAccount::unpack(buyer_token_acct.data.as_ref()).unwrap();
        assert_eq!(buyer_token_acct_parsed.mint, tapestry_patch_mint_key);
        assert_eq!(buyer_token_acct_parsed.owner, buyer.pubkey());
        assert_eq!(buyer_token_acct_parsed.amount, 1);
        assert_eq!(buyer_token_acct_parsed.delegate, COption::None);
        assert_eq!(buyer_token_acct_parsed.state, AccountState::Initialized);
    }

    // Doesn't actually validate if image is a valid, so use some random bytes
    let image_data = vec![0, 1, 2, 3, 4, 5, 6, 7, 8];

    let update_patch_image_ix = get_ix_update_patch_image(
        program_id,
        buyer.pubkey(),
        patch_x,
        patch_y,
        image_data.clone(),
    );

    let update_patch_image_tx = Transaction::new_signed_with_payer(
        &[update_patch_image_ix],
        Some(&buyer.pubkey()),
        &[&buyer],
        recent_blockhash,
    );

    let update_patch_image_result = banks_client
        .process_transaction(update_patch_image_tx)
        .await;

    assert_matches!(update_patch_image_result, Ok(()));

    {
        let tapestry_patch_acct = banks_client
            .get_account(tapestry_patch_key)
            .await
            .unwrap()
            .unwrap();

        let tapestry_patch: TapestryPatch =
            try_from_slice_unchecked(&tapestry_patch_acct.data).unwrap();

        assert_eq!(tapestry_patch.is_initialized, true);
        assert_eq!(tapestry_patch.x, patch_x);
        assert_eq!(tapestry_patch.y, patch_y);
        assert_eq!(tapestry_patch.owned_by_mint, tapestry_patch_mint_key);
        assert_eq!(tapestry_patch.url, None);
        assert_eq!(tapestry_patch.hover_text, None);
        assert_eq!(tapestry_patch.image_data, Some(image_data.clone()));
    }

    let url = String::from("https://tapestry.art");
    let hover_text = String::from("Check out this cool solana project");

    let update_patch_metadata_ix = get_ix_update_patch_metadata(
        program_id,
        buyer.pubkey(),
        patch_x,
        patch_y,
        Some(url.clone()),
        Some(hover_text.clone()),
    );

    let update_patch_metadata_tx = Transaction::new_signed_with_payer(
        &[update_patch_metadata_ix],
        Some(&buyer.pubkey()),
        &[&buyer],
        recent_blockhash,
    );

    let update_patch_metadata_result = banks_client
        .process_transaction(update_patch_metadata_tx)
        .await;

    assert_matches!(update_patch_metadata_result, Ok(()));

    {
        let tapestry_patch_acct = banks_client
            .get_account(tapestry_patch_key)
            .await
            .unwrap()
            .unwrap();

        let tapestry_patch: TapestryPatch =
            try_from_slice_unchecked(&tapestry_patch_acct.data).unwrap();

        assert_eq!(tapestry_patch.is_initialized, true);
        assert_eq!(tapestry_patch.x, patch_x);
        assert_eq!(tapestry_patch.y, patch_y);
        assert_eq!(tapestry_patch.owned_by_mint, tapestry_patch_mint_key);
        assert_eq!(tapestry_patch.url, Some(url.clone()));
        assert_eq!(tapestry_patch.hover_text, Some(hover_text.clone()));
        assert_eq!(tapestry_patch.image_data, Some(image_data.clone()));
    }

    // TODO(will): add off nominal / malicious test cases
}

// not entirely sure these pda's are guaranteed to be unique?
// this takes about 5 minutes to run
//
// use std::collections::HashSet;
//
// use solana_tapestry::state::{MAX_X, MAX_Y, MIN_X, MIN_Y, TAPESTRY_PATCH_MAX_LEN, TAPESTRY_PDA_PREFIX};
//
// #[tokio::test]
// async fn all_pdas_are_unique() {
//     let program_id = solana_tapestry::id();
//     let mut addrs = HashSet::new();
//     let mut counter = 0;

//     for i in MIN_X..=MAX_X {
//         for j in MIN_Y..=MAX_Y {
//             let (pda, _) = Pubkey::find_program_address(
//                 &[
//                     TAPESTRY_PDA_PREFIX.as_bytes(),
//                     &i.to_le_bytes(),
//                     &j.to_le_bytes(),
//                 ],
//                 &program_id,
//             );

//             counter += 1;
//             addrs.insert(pda);
//         }
//     }

//     assert_eq!(addrs.len() as u64, counter);
// }
