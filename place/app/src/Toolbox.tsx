import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PlaceClient, PlaceProgram, GameplayTokenType, GameplayTokenMetaAccount } from '@tapestrydao/place-client';
import { DragEventHandler, FC, useEffect, useState } from 'react';
import BN from 'bn.js';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';

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
    const [gameplayTokens, setGameplayTokens] = useState<Array<GameplayTokenMetaAccount>>([]);

    const onBuyButtonClicked = async () => {
        console.log("Buy Paintbrush Clicked");
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
        let accounts = placeClient.getSortedGameplayTokensForOwner(publicKey);
        setGameplayTokens(accounts);
    }

    useEffect(() => {
        // TODO(will): probably want to set up a signal here for when accounts change
        if (publicKey === null || publicKey === undefined) return;

        PlaceClient.getInstance().fetchGameplayTokensForOwner(publicKey)
            .then((accts) => setGameplayTokens(accts));

    }, [publicKey]);

    return <div className='toolbox__paintbrush-container'>
        <img className='toolbox__paintbrush-image' src="paintbrush_pixel.png"></img>
        <button onClick={onBuyButtonClicked} className='toolbox__buy_button'>{processingPurchase ? "Processing..." : "Buy"}</button>
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
            <Pallete />
        </div>
    );
};
