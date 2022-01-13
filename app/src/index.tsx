import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import { Wallet } from './Wallet';
import CssBaseline from '@mui/material/CssBaseline';

// Use require instead of import, and order matters
require('@solana/wallet-adapter-react-ui/styles.css');
require('./index.css');

ReactDOM.render(
    <StrictMode>
        <CssBaseline />
        <Wallet />
    </StrictMode>,
    document.getElementById('root')
);
