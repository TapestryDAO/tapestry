import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { FC } from 'react';

require('./toolbox.css');

export const Toolbox: FC = () => {
    const { wallet } = useWallet();

    return (
        <div className="toolbox__container">
            <div className='toolbox__header-container'>
                <h1 className="toolbox__header-heading">Tapestry</h1>
            </div>

            <div className="toolbox__actions">
                <WalletMultiButton > Connect </WalletMultiButton>
                {wallet && <WalletDisconnectButton />}
            </div>
        </div>
    );
};
