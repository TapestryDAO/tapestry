import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletDisconnectButton, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
    PlaceClient,
    PlaceProgram,
    GameplayTokenType,
    GameplayTokenFetchResult,
    GameplayTokenRecord,
    PlaceTokenAtaRecord,
} from "@tapestrydao/place-client";
import { DragEvent, FC, useEffect, useState } from "react";
import BN from "bn.js";
import { MintInfo, u64 } from "@solana/spl-token";
import { sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { TokenAccount } from "@metaplex-foundation/mpl-core";

require("./toolbox.css");

type PalleteColorProps = {
    color: string;
};

export const PalleteColor: FC<PalleteColorProps> = ({ color }) => {
    const handleDragStart = (event: DragEvent) => {
        console.log("drag start for color: ", color);
        event.dataTransfer?.setData("text/plain", color);
    };

    return (
        <div
            title={color}
            className="toolbox__pallete-pixel"
            style={{ backgroundColor: color }}
            draggable={true}
            onDragStart={handleDragStart}
        ></div>
    );
};

export const Pallete: FC = () => {
    let palleteColors = PlaceClient.getInstance().getColorPalleteHex();

    return (
        <>
            {palleteColors.map((color) => {
                return <PalleteColor color={color} />;
            })}
        </>
    );
};

export const PaintbrushTool: FC = () => {
    const [tokensTotal, setTokensTotal] = useState<number>(3);
    const [tokensReady, setTokensReady] = useState<number>(0);

    const toolQueueCount = tokensTotal - tokensReady;

    useEffect(() => {
        let placeClient = PlaceClient.getInstance();
        let subscription = placeClient.OnGameplayTokenRecordsUpdated.addMemo((records) => {
            if (records === null) {
                setTokensReady(0);
                setTokensTotal(0);
                return;
            }

            let tokensReady = records.filter((result) => {
                let client = PlaceClient.getInstance();
                if (client.currentSlot == null) return false;
                return result.gameplayTokenMetaAcct.data.update_allowed_slot.lte(
                    new BN(client.currentSlot)
                );
            });

            setTokensReady(tokensReady.length);
            setTokensTotal(records.length);
        });

        return () => {
            PlaceClient.getInstance().OnGameplayTokenRecordsUpdated.detach(subscription);
        };
    }, []);
    const headline = tokensReady ? "Ready!" : "Next Paint";

    return (
        <>
            <div className="flex flex-row my-auto justify-end w-full">
                {[...Array(toolQueueCount)].map(() => (
                    <img
                        className="toolbox__paintbrush-image h-16 border border-black"
                        src="paintbrush_pixel.png"
                    />
                ))}
            </div>
            <div className="border border-black rounded-md w-32 min-h-32 flex justify-start p-2 flex-col">
                <h3 className="w-full text-xl text-center">{headline}</h3>
                <img
                    className="toolbox__paintbrush-image h-16 border border-green-500"
                    src="paintbrush_pixel.png"
                />
            </div>
        </>
    );
};

export const Ownership: FC = () => {
    let { publicKey, sendTransaction } = useWallet();
    let { connection } = useConnection();
    let [claimableTokensCount, setClaimableTokensCount] = useState<number | null>(null);
    let [placeTokenSuppy, setPlaceTokenSuppy] = useState<number | null>(null);
    let [userOwnedTokens, setUserOwnedTokens] = useState<number | null>(null);
    let [claimProcessing, setClaimProcessing] = useState<boolean>(false);

    const [processingPurchase, setProcessingPurchase] = useState<boolean>(false);

    const onBuyButtonClicked = async () => {
        console.log("Buy Paintbrush Clicked");
        if (publicKey === null) return;

        let placeClient = PlaceClient.getInstance();
        let state = await placeClient.fetchPlaceStateAccount();
        setProcessingPurchase(true);

        console.log("payer: ", publicKey);
        console.log("token_type: ", GameplayTokenType.PaintBrush);
        console.log("desired_price: ", state.paintbrush_price);

        let ix = await placeClient.placeProgram.purchaseGameplayToken({
            payer: publicKey,
            token_type: GameplayTokenType.PaintBrush,
            desired_price: state.paintbrush_price,
        });

        let tx = new Transaction().add(ix);
        let signature = await sendTransaction(tx, connection);
        placeClient.awaitGptRecord(ix);
        let result = await connection.confirmTransaction(signature, "processed");

        setProcessingPurchase(false);
    };

    const updateClaimableTokensCount = (records: GameplayTokenRecord[] | null) => {
        if (records === null) {
            setClaimableTokensCount(0);
        } else {
            let count = records.reduce((prev, value) => {
                return prev + value.gameplayTokenMetaAcct.data.place_tokens_owed;
            }, 0);
            setClaimableTokensCount(count);
        }
    };

    const updatePlaceTokenSupply = (mintInfo: MintInfo | null) => {
        if (mintInfo === null) {
            setPlaceTokenSuppy(null);
            return;
        }

        let buffer = Buffer.from(mintInfo.supply);
        let supplyBN = u64.fromBuffer(buffer);
        let supply = parseInt(supplyBN.toString());
        setPlaceTokenSuppy(supply);
    };

    const updateUserPlaceTokens = (ataRecords: PlaceTokenAtaRecord[] | null) => {
        if (ataRecords === null) {
            setUserOwnedTokens(null);
            setClaimProcessing(false);
            return;
        }

        let tokenAmountTotal = ataRecords.reduce((prev, current) => {
            return prev.add(current.tokenAccount.data.amount);
        }, new BN(0));

        setUserOwnedTokens(tokenAmountTotal.toNumber());
    };

    const handleClaimButtonPressed = async () => {
        if (publicKey === null) return;
        setClaimProcessing(true);
        let claimTxs = await PlaceClient.getInstance().packClaimTokensTX();
        if (claimTxs === null) {
            setClaimProcessing(false);
            return;
        }

        for (let tx of claimTxs) {
            console.log("Sending claim tx");
            let sig = await sendTransaction(tx, connection);
            console.log("claim tx sig: ", sig);
        }

        setClaimProcessing(false);
    };

    useEffect(() => {
        let client = PlaceClient.getInstance();

        let gptSub = client.OnGameplayTokenRecordsUpdated.addMemo(updateClaimableTokensCount);
        let tokenMintSub = client.OnPlaceTokenMintUpdated.addMemo(updatePlaceTokenSupply);
        let tokenAcctsSub =
            client.OnCurrentUserPlaceTokenAcctsUpdated.addMemo(updateUserPlaceTokens);

        return () => {
            client.OnGameplayTokenRecordsUpdated.detach(gptSub);
            client.OnPlaceTokenMintUpdated.detach(tokenMintSub);
            client.OnCurrentUserPlaceTokenAcctsUpdated.detach(tokenAcctsSub);
        };
    }, [publicKey]);

    let showClaimTokensButton = claimableTokensCount !== null ? claimableTokensCount > 0 : false;
    let claimButtonText = claimProcessing ? "Processing..." : "CLAIM " + claimableTokensCount;

    return (
        <div className="toolbox__ownership-container">
            {/* <div className="toolbox__ownership-heading">
                <h4 className="pixel-font">Place Tokens</h4>
            </div>
            <div className="toolbox__ownership-stat">
                {placeTokenSuppy === null ? <></> : <h6>Total Supply: {placeTokenSuppy}</h6>}
            </div>
            <div className="toolbox__ownership-stat">
                {claimableTokensCount === null ? <></> : <h6>Claimable: {claimableTokensCount}</h6>}
            </div>
            <div className="toolbox__ownership-stat">
                {userOwnedTokens === null ? <></> : <h6>Owned: {userOwnedTokens}</h6>}
            </div> */}
            <button onClick={onBuyButtonClicked} className="toolbox__buy_button">
                {processingPurchase ? "Processing..." : "Buy"}
            </button>
            {showClaimTokensButton ? (
                <button
                    disabled={claimProcessing}
                    onClick={handleClaimButtonPressed}
                    className="toolbox__ownership-claim-tokens-btn"
                >
                    {claimButtonText}
                </button>
            ) : (
                <></>
            )}
        </div>
    );
};

export const Toolbox: FC = () => {
    const { wallet } = useWallet();

    return (
        <div className="toolbox__container grid md:grid-cols-5 grid-rows-2 md:grid-rows-none  grid-row-reverse py-2 md:gap-2 lg:gap-8 2xl:gap-16">
            <div className="w-full bg-gray-500 md:my-6 col-span-2 flex rounded-md order-last">
                <PaintbrushTool></PaintbrushTool>
            </div>
            <div className="w-full flex col-span-2 content-center md:py-6 ">
                <div className="flex-wrap w-full flex content-center shadow-sm shadow-black">
                    <Pallete />
                </div>
            </div>
            <div className="w-full hidden md:flex flex-col justify-center">
                <div className="toolbox__actions">
                    {!wallet && <WalletMultiButton>Connect Wallet</WalletMultiButton>}
                    {wallet && <WalletDisconnectButton />}
                </div>
                <Ownership></Ownership>
            </div>
        </div>
    );
};
