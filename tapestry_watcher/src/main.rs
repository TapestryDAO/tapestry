use solana_sdk::commitment_config::CommitmentLevel;
use solana_shadow::{BlockchainShadow, Network, SyncOptions};
use solana_tapestry::state::find_tapestry_state_address;
use std::thread::sleep;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // this is the prog id that owns all pyth oracles on mainnet

    let prog = solana_tapestry::id();
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

    loop {
        local.for_each_account(|pubkey, account| {
            println!(" - [{}]: {:?}", pubkey, account);
        });

        sleep(Duration::from_secs(3));

        // sleep(Duration::from_secs(3)).await;
    }

    local.worker().await.unwrap();

    Ok(())
}

// use solana_account_decoder::{UiAccountEncoding, UiDataSliceConfig};
// use solana_client::pubsub_client::PubsubClient;
// use solana_client::{rpc_client::RpcClient, rpc_config::RpcAccountInfoConfig};
// use solana_sdk::commitment_config::CommitmentConfig;
// /**
//  * pub struct RpcAccountInfoConfig {
//     pub encoding: Option<UiAccountEncoding>,
//     pub data_slice: Option<UiDataSliceConfig>,
//     #[serde(flatten)]
//     pub commitment: Option<CommitmentConfig>,
// }
//  */
// fn main() {
//     let rpc_url = String::from("http://127.0.0.1:8899");
//     // let my_client = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed());

//     let rpc_acct_info_config = RpcAccountInfoConfig {
//         encoding: Some(UiAccountEncoding::JsonParsed),
//         data_slice: None,
//         commitment: Some(CommitmentConfig::confirmed()),
//     };

//     let my_sub = PubsubClient::account_subscribe(
//         &rpc_url,
//         &solana_tapestry::id(),
//         Some(rpc_acct_info_config),
//     );

//     loop {
//         my_sub.read_message()
//     }

//     println!("Hello World!");
// }
