import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PlaceClient, PlaceProgram, GameplayTokenType } from '@tapestrydao/place-client';
import { DragEventHandler, FC, useState } from 'react';
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

    const onBuyButtonClicked = async () => {
        console.log("Buy Paintbrush Clicked");
        let state = await PlaceClient.getInstance().fetchPlaceStateAccount();
        setProcessingPurchase(true);
        let ix = await PlaceProgram.purchaseGameplayToken({
            payer: publicKey,
            token_type: GameplayTokenType.PaintBrush,
            desired_price: state.paintbrush_price,
        })

        let tx = new Transaction().add(ix);
        let result = await sendTransaction(tx, connection);
        console.log(result);
        setProcessingPurchase(false);
        await PlaceClient.getInstance().fetchGameplayTokensForOwner(publicKey);
    }

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
