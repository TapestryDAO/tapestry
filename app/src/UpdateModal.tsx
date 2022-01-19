import React, { FC, useState, useContext } from 'react'
import { Container, Typography, Box, Link, Button, Modal, TextField, Tooltip, Input } from '@mui/material'
import { Transaction } from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { TapestryPatchAccount, TapestryProgram, PurchasePatchParams } from '@tapestrydao/client';


export type ShowModalFn = (x: number, y: number, patch: TapestryPatchAccount | null) => void
export type PatchModalType = {
    showModal: ShowModalFn
}

export const PatchModalContext = React.createContext<PatchModalType>({
    showModal: (x, y, patch) => {
        console.log("DEFAULT PATCH MODAL CTX")
    }
});

export const usePatchModal = () => useContext(PatchModalContext)

export type PatchModalInfo = {
    showing: boolean
    x: number,
    y: number,
    patch?: TapestryPatchAccount
}

const DefaultPatchModalInfo: PatchModalInfo = {
    showing: false,
    x: 0,
    y: 0,
}

export const PatchModalProvider: FC = ({ children }) => {

    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();

    const [modalInfo, updateModalInfo] = useState(DefaultPatchModalInfo)

    const showModalFn: ShowModalFn = (x, y, patch) => {
        console.log("Patch: ", patch)
        if (patch === null) {
            sendTxPurchasePatch(x, y)
        } else {
            updateModalInfo({
                x: x,
                y: y,
                showing: true,
                patch: patch
            })
        }
    }

    const closeModalFn = () => {
        updateModalInfo(DefaultPatchModalInfo)
    }

    const sendTxPurchasePatch = async (x: number, y: number) => {
        console.log("Key: ", publicKey);
        console.log("Connection: ", connection);
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
    }

    return (
        <PatchModalContext.Provider value={{ showModal: showModalFn }}>
            {children}
            <PatchModal
                show={modalInfo.showing}
                x={modalInfo.x}
                y={modalInfo.y}
                patch={modalInfo.patch}
                closeModal={closeModalFn}
            />
        </PatchModalContext.Provider>
    )

}

type PatchModalProps = {
    show: boolean,
    x: number,
    y: number,
    patch?: TapestryPatchAccount
    closeModal: () => void
}

export const PatchModal: FC<PatchModalProps> = ({ show, x, y, patch, closeModal }: PatchModalProps) => {

    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    let hoverText = patch?.data.hover_text;
    let urlText = patch?.data.url;

    const handleHoverTextChanged = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        hoverText = event.target.value;
    }

    const handleUrlTextChanged = async (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        urlText = event.target.value;
    }

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
    };

    const modalStyle = {
        mt: 2,
        ml: 2,
        margin: 'auto',
        width: '50%',
        height: '50%',
        backgroundColor: { xs: "secondary.light", sm: "#F0F0F0" },
        boxShadow: 6,
    };

    return (

        <Modal
            open={show}
            onClose={closeModal}
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
    )
}