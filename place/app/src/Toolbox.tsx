import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PlaceClient } from '@tapestrydao/place-client';
import { FC } from 'react';

require('./toolbox.css');

export const Pallete: FC = () => {

    let palleteColors = PlaceClient.getInstance().getColorPalleteHex();

    return <div className='toolbox__pallete-container'>
        {palleteColors.map(color => {
            return <div title={color} className='toolbox__pallete-pixel' style={{ backgroundColor: color }}></div>
        })}
    </div>;
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
            <Pallete />
        </div>
    );
};
