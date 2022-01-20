import React, { ChangeEvent, ChangeEventHandler } from 'react';
import { FC, useCallback, useState, useEffect, createContext, useContext } from 'react';
import { Container, Typography, Box, Link, Button, Modal, TextField, Tooltip } from '@mui/material'
import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import SplitPane from 'react-split-pane';
import BN from 'bn.js';
import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  LAMPORTS_PER_SOL,
  AccountInfo,
  sendAndConfirmTransaction,
  Connection
} from '@solana/web3.js';

import {
  InitTapestryParams,
  TapestryProgram,
  PurchasePatchParams,
  TokenAccountsCache,
  TapestryStateAccount,
  TapestryPatchAccount,
} from "@tapestrydao/client";

import { Input } from '@mui/material';
import { KonvaTapestry } from './Tapestry'
import { PatchModalProvider } from './TapestryModal';

export const App: FC = () => {
  return (
    <div className="App">
      <PatchModalProvider>
        <KonvaTapestry />
      </PatchModalProvider>
    </div>
  );
};