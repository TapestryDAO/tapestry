use solana_client::pubsub_client;
use solana_place;
use solana_place::state::{Patch, PLACE_HEIGHT_PX, PLACE_WIDTH_PX};
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::{client::SyncClient, commitment_config::CommitmentLevel};
use solana_shadow::{BlockchainShadow, Network, SyncOptions};
use std::convert::TryInto;
use std::fs::File;
use std::io::BufWriter;
use std::thread::sleep;
use std::time::Duration;

use png;

use borsh::{maybestd::io::Error, BorshDeserialize, BorshSerialize};

pub struct MyPallete {}

impl MyPallete {
    pub fn u8_to_rgb(pixel: u8) -> &'static [u8; 3] {
        match pixel {
            0 => &[0, 0, 0],
            1 => &[1, 1, 1],
            2 => &[2, 2, 2],
            3 => &[3, 3, 3],
            4 => &[4, 4, 4],
            5 => &[0, 0, 0],
            6 => &[0, 0, 0],
            7 => &[0, 0, 0],
            8 => &[0, 0, 0],
            9 => &[0, 0, 0],
            10 => &[0, 0, 0],
            11 => &[0, 0, 0],
            12 => &[0, 0, 0],
            13 => &[0, 0, 0],
            14 => &[0, 0, 0],
            15 => &[0, 0, 0],
            16 => &[0, 0, 0],
            17 => &[0, 0, 0],
            18 => &[0, 0, 0],
            19 => &[0, 0, 0],
            20 => &[0, 0, 0],
            21 => &[0, 0, 0],
            22 => &[0, 0, 0],
            23 => &[0, 0, 0],
            24 => &[0, 0, 0],
            25 => &[0, 0, 0],
            26 => &[0, 0, 0],
            27 => &[0, 0, 0],
            28 => &[0, 0, 0],
            29 => &[0, 0, 0],
            30 => &[0, 0, 0],
            31 => &[0, 0, 0],
            32 => &[0, 0, 0],
            _ => &[0, 0, 0],
        }
    }
}

pub fn try_from_slice_unchecked<T: BorshDeserialize>(data: &[u8]) -> Result<T, Error> {
    let mut data_mut = data;
    let result = T::deserialize(&mut data_mut)?;
    Ok(result)
}

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
                        let pixel_data_size: usize =
                            (PLACE_WIDTH_PX * PLACE_HEIGHT_PX * 3) as usize;
                        let pixel_data = vec![0u8; pixel_data_size];
                        let mut path = std::env::temp_dir();
                        path.push(format!("{}.png", slot.slot));
                        let file = File::create(path).unwrap();
                        let ref mut w = BufWriter::new(file);
                        let mut encoder =
                            png::Encoder::new(w, PLACE_WIDTH_PX as u32, PLACE_HEIGHT_PX as u32);
                        encoder.set_color(png::ColorType::Rgb);
                        encoder.set_depth(png::BitDepth::Eight);
                        local.for_each_account(|pubkey, account| {
                            println!("Key: ");
                            let data = account.data.as_slice();
                            let parse_result = Patch::from_bytes(data);
                            match parse_result {
                                Ok(patch) => {
                                    let idx =
                                        ((patch.y as u16 * PLACE_HEIGHT_PX) + patch.x as u16) * 3;
                                    let pixels = patch.pixels.as_slice().iter();
                                    for (pixel_offset, pixel) in pixels.enumerate() {}
                                }
                                Err(_) => {}
                            }
                        });
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
