use borsh::{maybestd::io::Error, BorshDeserialize, BorshSerialize};
use png;
use solana_client::pubsub_client;
use solana_place;
use solana_place::state::{Patch, PATCH_SIZE_PX, PLACE_HEIGHT_PX, PLACE_WIDTH_PX};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::{client::SyncClient, commitment_config::CommitmentLevel};
use solana_shadow::{BlockchainShadow, Network, SyncOptions};
use std::convert::TryInto;
use std::fs::File;
use std::io::BufWriter;
use std::thread::sleep;
use std::time::Duration;

mod blend32;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // println!("cargo:rerun-if-env-changed=SOLANA_PLACE_PROGRAM_ID");
    let prog = solana_place::id();
    let sync_options = SyncOptions {
        network: Network::Localhost,
        max_lag: None,
        reconnect_every: None,
        rpc_timeout: Duration::from_secs(10),
        ws_connect_timeout: Duration::from_secs(10),
        commitment: CommitmentLevel::Confirmed,
    };

    // let mut updates_channel = local.updates_channel();

    // const config: CommitmentConfig = CommitmentConfig {
    //     commitment: CommitmentLevel::Processed,
    // };

    let rpc_url: String = String::from("ws://127.0.0.1:8900");

    // let client = rpc_client::RpcClient::new_with_commitment(rpc_url, config);
    let (_subscription, receiver) = pubsub_client::PubsubClient::slot_subscribe(&rpc_url)?;

    let thread = tokio::spawn(async move {
        let local = BlockchainShadow::new_for_program(&prog, sync_options)
            .await
            .unwrap();

        loop {
            match receiver.recv() {
                Ok(slot) => {
                    println!("Got slot: {}", slot.slot);
                    if slot.slot % 100 == 0 {
                        let place_height_px = PLACE_HEIGHT_PX as usize;
                        let place_width_px = PLACE_WIDTH_PX as usize;
                        let patch_size_px = PATCH_SIZE_PX as usize;
                        let pixel_data_size: usize =
                            (place_width_px * place_height_px * 3) as usize;
                        let mut pixel_data = vec![0u8; pixel_data_size];
                        let mut path = std::env::temp_dir();
                        path.push(format!("{}.png", slot.slot));
                        let file = File::create(path).unwrap();
                        let ref mut w = BufWriter::new(file);
                        let mut encoder =
                            png::Encoder::new(w, place_width_px as u32, place_height_px as u32);
                        encoder.set_color(png::ColorType::Rgb);
                        encoder.set_depth(png::BitDepth::Eight);
                        local.for_each_account(|_, account| {
                            let data = account.data.as_slice();
                            let parse_result = Patch::from_bytes(data);
                            match parse_result {
                                Ok(patch) => {
                                    if patch.x >= 50 || patch.y >= 50 {
                                        println!("patch out of bounds");
                                        return;
                                    }
                                    let place_x_tl = patch.x as usize * patch_size_px;
                                    let place_y_tl = patch.y as usize * patch_size_px;
                                    println!(
                                        "Patch X: {}, Patch Y: {}, Place X: {}, Place Y: {}",
                                        patch.x, patch.y, place_x_tl, place_y_tl
                                    );
                                    let pixels = patch.pixels.as_slice().iter();
                                    for (patch_idx, pixel) in pixels.enumerate() {
                                        let pixel_rgb = blend32::Blend32::u8_to_rgb(*pixel);
                                        let place_y = place_y_tl + (patch_idx / PATCH_SIZE_PX);
                                        let place_x = place_x_tl + (patch_idx % PATCH_SIZE_PX);
                                        let pixel_offset =
                                            ((place_y * place_width_px) + place_x) * 3;
                                        pixel_data[pixel_offset] = pixel_rgb[0];
                                        pixel_data[pixel_offset + 1] = pixel_rgb[1];
                                        pixel_data[pixel_offset + 2] = pixel_rgb[2];
                                    }
                                }
                                Err(_) => {}
                            }
                        });

                        let mut writer = encoder.write_header().unwrap();
                        writer.write_image_data(&pixel_data).unwrap();
                    }
                }
                Err(_err) => {
                    println!("got err");
                }
            }
        }
    });

    // tokio::spawn(async move {
    //     while let Ok((pubkey, account)) = updates_channel.recv().await {
    //         println!("Got update for {}", pubkey);

    //         // let result: Result<TapestryPatch, Error> =
    //         //     try_from_slice_unchecked(account.data.as_slice());

    //         let mut data = account.data.as_slice();
    //         // let mut data_mut = data;
    //         // let result = TapestryPatch::deserialize(&mut data);

    //         // match result {
    //         //     Ok(patch) => {
    //         //         println!("Patch: {},{}", patch.x, patch.y);
    //         //     }
    //         //     Err(e) => {
    //         //         println!("{}", e);
    //         //     }
    //         // }
    //     }
    // });

    // local.worker().await;

    let _result = thread.await;
    // println!("{}", _result);

    Ok(())
}
