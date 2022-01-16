
import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionCtorFields,
    TransactionInstruction,
    Transaction,
    Connection,
} from '@solana/web3.js';
import { Program } from '@metaplex-foundation/mpl-core'
import BufferLayout from '@solana/buffer-layout'
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

import {
    InitTapestryArgsData,
} from "./instructions/InitTapestry";

import { TAPESTRY_PROGRAM_ID } from "./constants"
import { PurchasePatchArgsData } from './instructions/PurchasePatch';
import { UpdatePatchImageArgsData } from './instructions/UpdatePatchImage';
import { extendBorsh } from "./utils";
import { UpdatePatchMetadataArgsData } from './instructions/UpdatePatchMetadata';

export type InitTapestryParams = {
    initialSalePrice: number;
    ownerPubkey: PublicKey;
};

export type PurchasePatchParams = {
    x: number,
    y: number,
    buyerPubkey: PublicKey,
}

export type UpdatePatchImageParams = {
    x: number,
    y: number,
    owner: PublicKey,
    image_data: Uint8Array,
}

export type UpdatePatchMetadataParams = {
    x: number,
    y: number,
    owner: PublicKey,
    url?: string,
    hover_text?: string,
}


/**
 * Factory for transactions to interact with the tapestry program
 * 
 * NOTE(will): A lot of these functions have to be async because they depending on finding a
 * PDA which is an async call, even though I don't think it uses much compute... annoying
 */
export class TapestryProgram extends Program {

    static readonly PUBKEY: PublicKey = TAPESTRY_PROGRAM_ID;
    static readonly tapestryStatePDAPrefix = "tapestry";
    static readonly tapestryMintPDAPrefix = "mint";

    static async initTapestry(params: InitTapestryParams): Promise<TransactionInstruction> {
        const data = InitTapestryArgsData.serialize({
            initial_sale_price: params.initialSalePrice,
        })

        let tapestryStateAddress = await this.findTapestryStateAddress();

        return new TransactionInstruction({
            keys: [
                { pubkey: params.ownerPubkey, isSigner: true, isWritable: true },
                { pubkey: tapestryStateAddress, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.PUBKEY,
            data
        });
    }

    static async purchasePatch(params: PurchasePatchParams): Promise<TransactionInstruction> {
        extendBorsh(); // TODO(will): figure out how to call this once 
        const data = PurchasePatchArgsData.serialize({
            x: params.x,
            y: params.y, // error here figure out how to serialize i16's
        })

        // console.log("creating buy patch ix: ", params.x, " ", params.y)

        let tapestryStateAddress = await this.findTapestryStateAddress();
        let tapestryPatchPDA = await this.findPatchAddressForPatchCoords(params.x, params.y);
        let tapestryPatchMint = await this.findMintAddressForPatchCoords(params.x, params.y);
        let patchAta = await this.findPatchATAForPatch(tapestryPatchMint, params.buyerPubkey);

        // console.log("buyer pub: ", params.buyerPubkey.toBase58());
        // console.log("state pda: ", tapestryStateAddress.toBase58());
        // console.log("patch pda: ", tapestryPatchPDA.toBase58());
        // console.log("mint  pda: ", tapestryPatchMint.toBase58());
        // console.log("ata   pda: ", patchAta.toBase58());

        return new TransactionInstruction({
            keys: [
                { pubkey: params.buyerPubkey, isSigner: true, isWritable: true },
                { pubkey: tapestryStateAddress, isSigner: false, isWritable: true },
                { pubkey: tapestryPatchPDA, isSigner: false, isWritable: true },
                { pubkey: tapestryPatchMint, isSigner: false, isWritable: true },
                { pubkey: patchAta, isSigner: false, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.PUBKEY,
            data: data,
        });
    }

    static async updatePatchImage(params: UpdatePatchImageParams) {
        extendBorsh(); // TODO(will): figure out how to call this once
        const data = UpdatePatchImageArgsData.serialize({
            x: params.x,
            y: params.y,
            image_data: Buffer.from(params.image_data),
        })

        // console.log("creating update patch ix: ", params.x, ",", params.y)

        let tapestryPatchPDA = await this.findPatchAddressForPatchCoords(params.x, params.y);
        let tapestryPatchMint = await this.findMintAddressForPatchCoords(params.x, params.y);
        let patchAta = await this.findPatchATAForPatch(tapestryPatchMint, params.owner);

        return new TransactionInstruction({
            keys: [
                { pubkey: params.owner, isSigner: true, isWritable: false },
                { pubkey: patchAta, isSigner: false, isWritable: false },
                { pubkey: tapestryPatchPDA, isSigner: false, isWritable: true },
            ],
            programId: this.PUBKEY,
            data: data,
        })
    }

    static async updatePatchMetadata(params: UpdatePatchMetadataParams) {
        extendBorsh(); // TODO(will): figure out how to call this once

        const data = UpdatePatchMetadataArgsData.serialize({
            x: params.x,
            y: params.y,
            url: params.url,
            hover_text: params.hover_text,
        });

        // console.log("creating update patch meta ix: ", params.x, ",", params.y);

        let tapestryPatchPDA = await this.findPatchAddressForPatchCoords(params.x, params.y);
        let tapestryPatchMint = await this.findMintAddressForPatchCoords(params.x, params.y);
        let patchAta = await this.findPatchATAForPatch(tapestryPatchMint, params.owner);

        return new TransactionInstruction({
            keys: [
                { pubkey: params.owner, isSigner: true, isWritable: false },
                { pubkey: patchAta, isSigner: false, isWritable: false },
                { pubkey: tapestryPatchPDA, isSigner: false, isWritable: true },
            ],
            programId: this.PUBKEY,
            data: data,
        })
    }

    static async findPatchATAForPatch(
        mint: PublicKey,
        buyer: PublicKey) {
        return Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mint,
            buyer,
            false);
    }

    // NOTE(will): kind of annoying that this is async
    static async findTapestryStateAddress(): Promise<PublicKey> {
        // cache this? how long does this actually take to compute?
        let result = await PublicKey.findProgramAddress([Buffer.from(this.tapestryStatePDAPrefix)], this.PUBKEY)
        return result[0]
    }

    static async findPatchAddressForPatchCoords(x: number, y: number) {

        let x_buf = Buffer.alloc(2);
        x_buf.writeInt16LE(x, 0);
        let y_buf = Buffer.alloc(2);
        y_buf.writeInt16LE(y, 0);

        let seeds = Buffer.concat([
            Buffer.from(this.tapestryStatePDAPrefix),
            x_buf,
            y_buf,
        ])

        let result = await PublicKey.findProgramAddress([seeds], this.PUBKEY)
        return result[0];
    }

    static async findMintAddressForPatchCoords(x: number, y: number) {
        let x_buf = Buffer.alloc(2);
        x_buf.writeInt16LE(x, 0);
        let y_buf = Buffer.alloc(2);
        y_buf.writeInt16LE(y, 0);

        let seeds = Buffer.concat([
            Buffer.from(this.tapestryStatePDAPrefix),
            Buffer.from(this.tapestryMintPDAPrefix),
            x_buf,
            y_buf,
        ])

        let result = await PublicKey.findProgramAddress([seeds], this.PUBKEY)
        return result[0]
    }
}