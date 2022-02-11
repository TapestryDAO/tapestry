import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PlaceClient, PlaceProgram, GameplayTokenType, GameplayTokenFetchResult } from '@tapestrydao/place-client';
import { DragEventHandler, FC, UIEventHandler, useEffect, useState } from 'react';
import BN from 'bn.js';
import { MintInfo, u64 } from '@solana/spl-token';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { TokenAccount } from '@metaplex-foundation/mpl-core';

require('./toolbox.css');

type PalleteColorProps = {
    color: string,
}

export const PalleteColor: FC<PalleteColorProps> = ({ color }) => {

    const handleDragStart = (event: DragEvent) => {
        console.log("drag start for color: ", color);
        event.dataTransfer?.setData("text/plain", color)
    }

    return <div
        title={color}
        className='toolbox__pallete-pixel'
        style={{ backgroundColor: color }}
        draggable={true}
        onDragStart={handleDragStart}>
    </div>
}

export const Pallete: FC = () => {

    let palleteColors = PlaceClient.getInstance().getColorPalleteHex();

    return <div className='toolbox__pallete-container'>
        {palleteColors.map(color => {
            return <PalleteColor color={color} />
        })}
    </div>;
}

export const PaintbrushTool: FC = () => {
    const { connection } = useConnection();
    const { sendTransaction, publicKey } = useWallet();
    const [processingPurchase, setProcessingPurchase] = useState<boolean>(false);
    const [gameplayTokens, setGameplayTokens] = useState<Array<GameplayTokenFetchResult>>([]);

    const onBuyButtonClicked = async () => {
        console.log("Buy Paintbrush Clicked");
        if (publicKey === null) return;

        let placeClient = PlaceClient.getInstance()
        let state = await placeClient.fetchPlaceStateAccount();
        setProcessingPurchase(true);

        console.log("payer: ", publicKey);
        console.log("token_type: ", GameplayTokenType.PaintBrush);
        console.log("desired_price: ", state.paintbrush_price);
        let ix = await PlaceProgram.purchaseGameplayToken({
            payer: publicKey,
            token_type: GameplayTokenType.PaintBrush,
            desired_price: state.paintbrush_price,
        })

        let tx = new Transaction().add(ix);
        let signature = await sendTransaction(tx, connection);
        // NOTE(will): it seems like using "processed" should work here, but
        // then when I refresh the token accounts for the user, the newly minted NFT isn't returned
        // immediately, finalized takes a while on local host, so probably takes even longer on mainnet
        // so need to find another solution
        let result = await connection.confirmTransaction(signature, "finalized")
        console.log(result);
        setProcessingPurchase(false);
        await placeClient.fetchGameplayTokensForOwner(publicKey);
    }

    useEffect(() => {
        if (publicKey === null || publicKey === undefined) return;

        let placeClient = PlaceClient.getInstance();

        let subscription = placeClient.OnGameplayTokenAcctsDidUpdate.add((owner, accounts) => {
            if (owner === publicKey) {
                setGameplayTokens(accounts);
            }
        })

        // Trigger a fetch
        PlaceClient.getInstance().fetchGameplayTokensForOwner(publicKey);

        return () => {
            PlaceClient.getInstance().OnGameplayTokenAcctsDidUpdate.detach(subscription)
        }
    }, [publicKey]);

    let client = PlaceClient.getInstance();

    let totalTokenResults = gameplayTokens.filter((result) => result.gameplayTokenAccount !== null);

    // TODO(will): currentSlot is annoyingly null here sometimes
    let tokensReady = totalTokenResults.filter((result) => {
        let gameplayToken = result.gameplayTokenAccount
        if (gameplayToken === null) {
            return false;
        }

        if (client.currentSlot == null) {
            return false;
        }

        return gameplayToken.data.update_allowed_slot.lte(new BN(client.currentSlot));
    });

    return <div className='toolbox__paintbrush-container'>
        <img className='toolbox__paintbrush-image' src="paintbrush_pixel.png"></img>
        <h4>Ready: {tokensReady.length}/{totalTokenResults.length}</h4>
        <button onClick={onBuyButtonClicked} className='toolbox__buy_button'>{processingPurchase ? "Processing..." : "Buy"}</button>
    </div>
}

export const Ownership: FC = () => {

    let { publicKey, sendTransaction } = useWallet();
    let { connection } = useConnection();
    let [claimableTokensCount, setClaimableTokensCount] = useState<number | null>(null);
    let [placeTokenSuppy, setPlaceTokenSuppy] = useState<number | null>(null);
    let [userOwnedTokens, setUserOwnedTokens] = useState<number | null>(null);
    let [claimProcessing, setClaimProcessing] = useState<boolean>(false);

    const updateClaimableTokensCount = () => {
        let client = PlaceClient.getInstance();
        if (publicKey !== null && publicKey !== undefined) {
            let count = client.getTotalClaimableTokensCount(publicKey);
            setClaimableTokensCount(count);
        } else {
            setClaimableTokensCount(null);
        }
    }

    const updatePlaceTokenSupply = (mintInfo: MintInfo | null) => {
        if (mintInfo === null) {
            setPlaceTokenSuppy(null);
            return;
        }

        let buffer = Buffer.from(mintInfo.supply);
        let supplyBN = u64.fromBuffer(buffer);
        let supply = parseInt(supplyBN.toString());
        setPlaceTokenSuppy(supply);
    }

    const updateUserPlaceTokens = (tokenAccts: TokenAccount[] | null) => {
        if (tokenAccts === null) {
            setUserOwnedTokens(null);
            return;
        }

        let tokenAmountTotal = tokenAccts.reduce((prev, current) => {
            return prev.add(current.data.amount)
        }, new BN(0));
        setUserOwnedTokens(tokenAmountTotal.toNumber())
    }

    const handleClaimButtonPressed = async () => {
        if (publicKey === null) return;
        setClaimProcessing(true);
        let claimTxs = await PlaceClient.getInstance().packClaimTokensTX(publicKey);
        if (claimTxs === null) {
            setClaimProcessing(false);
            return;
        }

        for (let tx of claimTxs) {
            console.log("Sending claim tx");
            let sig = await sendTransaction(tx, connection);
            console.log("claim tx sig: ", sig);
            let result = await connection.confirmTransaction(sig, "finalized")
            console.log("Claim Result: ", result);
        }

        await PlaceClient.getInstance().fetchGameplayTokensForOwner(publicKey);

        setClaimProcessing(false);
    }

    useEffect(() => {
        let client = PlaceClient.getInstance();

        client.setCurrentUser(publicKey);

        updateClaimableTokensCount();
        let sub = client.OnGameplayTokenAcctsDidUpdate.add((owner, accts) => {
            console.log("app got gpt update")
            updateClaimableTokensCount();
        });

        updatePlaceTokenSupply(client.currentMintInfo)
        let tokenMintSub = client.OnPlaceTokenMintUpdated.add(updatePlaceTokenSupply);

        updateUserPlaceTokens(client.currentUserPlaceTokenAccounts)
        let tokenAcctsSub = client.OnCurrentUserPlaceTokenAcctsUpdated.add(updateUserPlaceTokens)

        return () => {
            client.OnGameplayTokenAcctsDidUpdate.detach(sub);
            client.OnPlaceTokenMintUpdated.detach(tokenMintSub);
            client.OnCurrentUserPlaceTokenAcctsUpdated.detach(tokenAcctsSub);
        };
    }, [publicKey])

    let showClaimTokensButton = claimableTokensCount !== null ? claimableTokensCount > 0 : false;
    let claimButtonText = claimProcessing ? "Processing..." : "CLAIM " + claimableTokensCount;

    return <div className="toolbox__ownership-container">
        <div className='toolbox__ownership-heading'>
            <h4>Place Tokens</h4>
        </div>
        <div className="toolbox__ownership-stat">
            {placeTokenSuppy === null ? <></> : <h6>Total Supply: {placeTokenSuppy}</h6>}
        </div>
        <div className='toolbox__ownership-stat'>
            {claimableTokensCount === null ?
                <></> :
                <h6>Claimable: {claimableTokensCount}</h6>
            }
        </div>
        <div className='toolbox__ownership-stat'>
            {userOwnedTokens === null ? <></> : <h6>Owned: {userOwnedTokens}</h6>}
        </div>
        {showClaimTokensButton ?
            <button
                disabled={claimProcessing}
                onClick={handleClaimButtonPressed}
                className='toolbox__ownership-claim-tokens-btn'
            >{claimButtonText}</button>
            : <></>}
    </div>
}

export const Toolbox: FC = () => {
    const { wallet } = useWallet();

    return (
        <div className="toolbox__container">
            <div className='toolbox__header-container'>
                <h1 className="toolbox__header-heading">Tapestry</h1>
            </div>
            <div className="toolbox__actions">
                {!wallet && <WalletMultiButton>Connect Wallet</WalletMultiButton>}
                {wallet && <WalletDisconnectButton />}
            </div>
            <PaintbrushTool></PaintbrushTool>
            <Ownership></Ownership>
            <Pallete />
        </div>
    );
};
