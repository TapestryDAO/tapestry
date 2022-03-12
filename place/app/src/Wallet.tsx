import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    LedgerWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    SolletExtensionWalletAdapter,
    SolletWalletAdapter,
    TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import React, { FC, useCallback, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Toolbox } from "./Toolbox";
import { Notification } from "./Notification";
import { App } from "./App";
import { PLACE_VERSION, PLACE_ENDPOINT, SolanaNetwork } from "@tapestrydao/place-client";

export const Wallet: FC = () => {
    // Can be set to 'devnet', 'testnet', or 'mainnet-beta'

    if (PLACE_VERSION.network !== PLACE_ENDPOINT.network) {
        throw Error("version and endpoint did not have matching network");
    }

    let network: WalletAdapterNetwork = WalletAdapterNetwork.Devnet;

    switch (PLACE_ENDPOINT.network) {
        case SolanaNetwork.Localhost:
            network = WalletAdapterNetwork.Devnet; // unsure what to do for this?
            break;
        case SolanaNetwork.Testnet:
            network = WalletAdapterNetwork.Testnet;
            break;
        case SolanaNetwork.Devnet:
            network = WalletAdapterNetwork.Devnet;
            break;
        case SolanaNetwork.Mainnet:
            network = WalletAdapterNetwork.Mainnet;
            break;
    }

    // You can also provide a custom RPC endpoint
    // const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    const endpoint = PLACE_ENDPOINT.url;

    // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking and lazy loading --
    // Only the wallets you configure here will be compiled into your application, and only the dependencies
    // of wallets that your users connect to will be loaded
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SlopeWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
            new LedgerWalletAdapter(),
            new SolletWalletAdapter({ network }),
            new SolletExtensionWalletAdapter({ network }),
        ],
        [network]
    );

    const onError = useCallback(
        (error: WalletError) =>
            toast.custom(
                <Notification
                    message={error.message ? `${error.name}: ${error.message}` : error.name}
                    variant="error"
                />
            ),
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} onError={onError} autoConnect>
                <WalletModalProvider>
                    <div className="flex flex-col w-full">
                        <App />
                        <Toolbox />
                    </div>
                </WalletModalProvider>
                <Toaster position="bottom-left" reverseOrder={false} />
            </WalletProvider>
        </ConnectionProvider>
    );
};
