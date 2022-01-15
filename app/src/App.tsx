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

type PatchProps = {
  x: number,
  y: number,
};

export const Patch: FC<PatchProps> = ({ x, y }: PatchProps) => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // TODO(will): clean this crap up, maybe useMemo / useCallback can help here?

  let fetchFlag = false;

  const [patchAccount, setPatchAccount] = useState<TapestryPatchAccount | null>(null);
  const [isOwned, setIsOwned] = useState<boolean>(false);

  const [showModal, setShowModal] = useState(false);

  const handleClose = () => setShowModal(false);
  const handleShow = () => setShowModal(true);

  const checkIsOwned = async (owner: PublicKey) => {
    let owned = false;
    if (!!publicKey && !!connection && !!patchAccount) {
      owned = await patchAccount.isOwnedBy(connection, publicKey);
    }

    if (isOwned != owned) {
      setIsOwned(owned);
    }
  };

  const fetchPatch = async () => {
    fetchFlag = true;

    console.log("fetching patch - " + x + "," + y);
    const patch = await TapestryPatchAccount.fetch(connection, x, y);
    setPatchAccount(patch);
  };

  const sendTxPurchasePatch = async () => {

    if (!publicKey) return;
    if (!connection) return;

    let params: PurchasePatchParams = {
      x: x,
      y: y,
      buyerPubkey: publicKey,
    }

    let ix = await TapestryProgram.purchasePatch(params);
    let tx = new Transaction().add(ix);
    const signature = await sendTransaction(tx, connection);
    let result = await connection.confirmTransaction(signature, 'confirmed');

    console.log("Completed Purchase: ", result.value.err);

    // Force reload the cache
    await TokenAccountsCache.singleton.refreshCache(connection, publicKey, true);

    fetchFlag = false;
    fetchPatch();
  };

  useEffect(() => {
    fetchPatch();
  }, [fetchFlag, publicKey]);

  if (!!publicKey) {
    checkIsOwned(publicKey);
  }

  const modalStyle = {
    mt: 2,
    ml: 2,
    margin: 'auto',
    width: '50%',
    height: '50%',
    backgroundColor: { xs: "secondary.light", sm: "#F0F0F0" },
    boxShadow: 6,
  };

  const handleInputChanged = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(event);
    console.log(event.currentTarget);
    console.log(event.currentTarget.files);

    if (!event.currentTarget.files) return;

    let file = Array.from(event.currentTarget.files)[0];
    const buffer = await file.arrayBuffer();
    let byteArray = new Uint8Array(buffer);

    let ix = await TapestryProgram.updatePatchImage({
      x: x,
      y: y,
      image_data: byteArray,
      owner: publicKey!,
    });

    let tx = new Transaction().add(ix);
    const signature = await sendTransaction(tx, connection);
    let result = await connection.confirmTransaction(signature, 'confirmed');

    console.log("Completed Update: ", result.value.err);

    // Force reload the cache
    // await TokenAccountsCache.singleton.refreshCache(connection, publicKey!, true);

    fetchFlag = false;
    fetchPatch();
  }

  let hoverText = patchAccount?.data.hover_text;
  let urlText = patchAccount?.data.url;

  const handleHoverTextChanged = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    hoverText = event.target.value;
  }

  const handleUrlTextChanged = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    urlText = event.target.value;
  }

  const clickedLink = async () => {
    let maybeUrl = patchAccount?.data.url;
    if (!!maybeUrl) {
      window.open(maybeUrl, '_blank');
    }
  }


  const sendTxUpdatePatchMetadata = async () => {
    if (!publicKey) return;
    if (!connection) return;

    let ix = await TapestryProgram.updatePatchMetadata({
      x: x,
      y: y,
      owner: publicKey,
      url: urlText,
      hover_text: hoverText,
    })

    let tx = new Transaction().add(ix);
    const signature = await sendTransaction(tx, connection);
    let result = await connection.confirmTransaction(signature, 'confirmed');

    console.log("Completed Update Metadata: ", result.value.err);

    fetchFlag = false;
    fetchPatch();
  };

  const clickedUpdatePatch = async () => {
    handleShow();
  };

  let imageSrc = "";

  if (!!patchAccount && !!patchAccount.data.image_data) {
    imageSrc = "data:image/gif;base64," + patchAccount.data.image_data.toString('base64');
  }

  return (
    <>
      <Tooltip title={!!hoverText ? hoverText : ""} hidden={!!hoverText} >
        <button className={isOwned ? 'patch owned' : 'patch'} onClick={isOwned ? clickedUpdatePatch : (!!patchAccount ? clickedLink : sendTxPurchasePatch)}>
          {!patchAccount ? "Buy" : ""}
          <img src={imageSrc} className='patch_image'></img>
        </button>
      </Tooltip>
      <Modal
        open={showModal}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Container sx={modalStyle}>
          <Typography variant="h4"> Image </Typography>
          <Input type="file" onChange={handleInputChanged}></Input>
          <br></br>
          <Typography variant="h4">URL</Typography>
          <TextField value={urlText} id="update-url-field" label="Filled" variant="filled" fullWidth={true} onChange={handleUrlTextChanged} />
          <br></br>
          <Typography variant="h4">Hover Text</Typography>
          <TextField value={hoverText} id="update-hover-text-field" label="Filled" variant="filled" fullWidth={true} onChange={handleHoverTextChanged} />
          <Button onClick={sendTxUpdatePatchMetadata}>Update Metadata</Button>
        </Container>
      </Modal>
    </>
  )
}

export const Tapestry: FC = () => {

  const gridSize = 10;

  return (
    <div>
      {[...Array(gridSize)].map((_, y) => {
        return (
          <div className='tapestry-row' key={y}>
            {[...Array(gridSize)].map((_, x) => <Patch key={x + "," + y} x={x} y={y} />)}
          </div>
        );
      })}
    </div>
  );
}

export const InitTapestryComponent: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const sendTxInitTapestry = useCallback(async () => {
    if (!publicKey) throw new WalletNotConnectedError();

    let params: InitTapestryParams = {
      initialSalePrice: 10_000_000,
      ownerPubkey: publicKey,
    }

    let ix = await TapestryProgram.initTapestry(params);
    let tx = new Transaction().add(ix);
    const signature = await sendTransaction(tx, connection);
    let result = await connection.confirmTransaction(signature, 'confirmed');

    console.log("Completed Init Tapesry: ", result.value.err);
  }, [publicKey, connection]);

  return (
    <Container>
      <Button onClick={sendTxInitTapestry} disabled={!publicKey}> Init Tapestry </Button>
    </Container>
  )
};

export const TapestryStateAcctComp: FC = () => {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [tapestryState, setTapestryState] = useState<TapestryStateAccount | null>(null);

  const fetchTapestryState = async () => {
    let state = await TapestryStateAccount.fetchState(connection);
    setTapestryState(state);
  };

  useEffect(() => { fetchTapestryState() }, [connection, publicKey]);

  let stateBalance = !!tapestryState ?
    tapestryState.info.lamports / LAMPORTS_PER_SOL : 0;
  let initialSalePrice = !!tapestryState ?
    tapestryState.data.initial_sale_price.toNumber() / LAMPORTS_PER_SOL : 0;
  return (
    <Container>
      <p>Tapestry State Pubkey: {tapestryState?.pubkey.toBase58()}</p>
      <p>Owner: {tapestryState?.data.owner?.toBase58()}</p>
      <p>Price: {initialSalePrice}</p>
      <p>Balance: {stateBalance}</p>
      <Button onClick={fetchTapestryState} disabled={!publicKey}>Fetch Tapestry State</Button>
    </Container>
  )
}

export const GetAirdrop: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const airdropSol = useCallback(async () => {

    if (!publicKey) throw new WalletNotConnectedError();

    connection.requestAirdrop(publicKey!, 100 * LAMPORTS_PER_SOL).then(() => {
      console.log("Got Airdrop")
    });
  }, [publicKey, connection]);

  return (
    <Button onClick={airdropSol} disabled={!publicKey} > Airdrop </Button>
  );
};

export const LeftPane: FC = () => {

  const { connection } = useConnection();
  const { publicKey } = useWallet();

  const [walletBalance, setWalletBalance] = useState<number>(0);

  const checkBalance = async () => {
    if (!publicKey) return;
    console.log("checking balance");
    let result = await connection.getBalance(publicKey);

    let sol_balance = result / LAMPORTS_PER_SOL;
    console.log("Balance was: ", sol_balance);
    setWalletBalance(sol_balance);
  }

  checkBalance();

  return (
    <Container>
      <TapestryStateAcctComp />
      <Box>
        <Typography>Init Tapestry</Typography>
        <InitTapestryComponent />
      </Box>
      <Box>
        <Typography> Wallet Balance: {walletBalance} </Typography>
        <Button onClick={checkBalance} disabled={!publicKey}> Check Balance </Button>
        <Typography> Airdrop Sol </Typography>
        <GetAirdrop />
      </Box>
    </Container>
  )
}


export const App: FC = () => {
  return (
    <div className="App">
      <SplitPane split="vertical" minSize={200} defaultSize={400} maxSize={400} style={{ backgroundColor: "white" }}>
        <LeftPane />
        <Tapestry />
      </SplitPane>
    </div>
  );
};