use solana_place;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::{client::SyncClient, commitment_config::CommitmentLevel};
use solana_shadow::{BlockchainShadow, Network, SyncOptions};
use std::convert::TryInto;
use std::thread::sleep;
use std::time::Duration;

use borsh::{maybestd::io::Error, BorshDeserialize, BorshSerialize};

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

    let local = BlockchainShadow::new_for_program(&prog, sync_options)
        .await
        .unwrap();

    let mut updates_channel = local.updates_channel();

    println!("{}", solana_place::id());
    println!("{}", std::env!("SOLANA_PLACE_PROGRAM_ID"));

    tokio::spawn(async move {
        while let Ok((pubkey, account)) = updates_channel.recv().await {
            println!("Got update for {}", pubkey);

            // let result: Result<TapestryPatch, Error> =
            //     try_from_slice_unchecked(account.data.as_slice());

            let mut data = account.data.as_slice();
            // let mut data_mut = data;
            // let result = TapestryPatch::deserialize(&mut data);

            // match result {
            //     Ok(patch) => {
            //         println!("Patch: {},{}", patch.x, patch.y);
            //     }
            //     Err(e) => {
            //         println!("{}", e);
            //     }
            // }
        }
    });

    local.worker().await;

    Ok(())
}
