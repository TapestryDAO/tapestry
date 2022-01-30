import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { FC } from 'react';

require('./navigation.css');

export const Navigation: FC = () => {
    const { wallet } = useWallet();

    return (
        <nav className="nav">
            <h1 className="nav__heading">Tapestry</h1>
            <div className="nav__actions">
                <WalletMultiButton />
                {wallet && <WalletDisconnectButton />}
            </div>
        </nav>
    );
};
