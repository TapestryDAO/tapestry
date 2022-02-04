import {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
} from '@solana/web3.js'
import { Program } from '@metaplex-foundation/mpl-core'
import { SetPixelArgsData } from './instructions/setPixel';
import { InitPatchArgsData } from './instructions/initPatch';
import { UpdatePlaceStateArgsData } from './instructions/updatePlaceState';
import BN from 'bn.js';

export const PLACE_HEIGHT_PX = 1000;
export const PLACE_WIDTH_PX = 1000;
export const PATCH_SIZE_PX = 20;

export type SetPixelParams = {
    x: number,
    y: number,
    pixel: number,
    payer: PublicKey,
}

export type InitPatchParams = {
    xPatch: number,
    yPatch: number,
    payer: PublicKey,
}

export type UpdatePlaceStateParams = {
    current_owner: PublicKey,
    new_owner: PublicKey | null,
    is_frozen: boolean | null,
    paintbrush_price: BN | null,
    paintbrush_cooldown: BN | null,
    bomb_price: BN | null,
}

type PixelPatchCoords = {
    xPatch: number,
    yPatch: number,
    xOffset: number,
    yOffset: number,
}

export class PlaceProgram extends Program {
    static readonly PUBKEY: PublicKey = new PublicKey('tapestry11111111111111111111111111111111111');

    static readonly PATCH_PDA_PREFIX = "patch";
    static readonly PLACE_STATE_PDA_PREFIX = "place";

    static async initPatch(params: InitPatchParams) {
        let data = InitPatchArgsData.serialize({
            xPatch: params.xPatch,
            yPatch: params.yPatch,
        })

        let patchPda = await this.findPatchPda(params.xPatch, params.yPatch);

        return new TransactionInstruction({
            keys: [
                { pubkey: params.payer, isSigner: true, isWritable: true },
                { pubkey: patchPda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.PUBKEY,
            data: data,
        })
    }

    static async updatePlaceState(params: UpdatePlaceStateParams) {
        let place_state_pda = await this.findPlaceStatePda();
        let data = UpdatePlaceStateArgsData.serialize({
            new_owner: params.new_owner,
            is_frozen: params.is_frozen,
            paintbrush_price: params.paintbrush_price,
            paintbrush_cooldown: params.paintbrush_cooldown,
            bomb_price: params.bomb_price,
        })

        return new TransactionInstruction({
            keys: [
                { pubkey: params.current_owner, isSigner: true, isWritable: true },
                { pubkey: place_state_pda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.PUBKEY,
            data: data,
        });
    }

    static async setPixel(params: SetPixelParams) {
        let patchCoords = this.computePatchCoords(params.x, params.y);

        console.log("Setting Patch Coords: ", patchCoords, "to color: ", params.pixel);
        let data = SetPixelArgsData.serialize({
            x: patchCoords.xPatch,
            y: patchCoords.yPatch,
            x_offset: patchCoords.xOffset,
            y_offset: patchCoords.yOffset,
            pixel: params.pixel,
        });

        let patchPda = await this.findPatchPda(patchCoords.xPatch, patchCoords.yPatch);

        return new TransactionInstruction({
            keys: [
                // TODO(will): this doesn't need to be writable after removing lazy alloc
                { pubkey: params.payer, isSigner: true, isWritable: true },
                { pubkey: patchPda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.PUBKEY,
            data: data,
        })
    }

    static async findPatchPda(xPatch: number, yPatch: number): Promise<PublicKey> {
        let xBuf = Buffer.alloc(1);
        xBuf.writeUInt8(xPatch);
        let yBuf = Buffer.alloc(1);
        yBuf.writeUInt8(yPatch);

        let seeds = Buffer.concat([
            Buffer.from(this.PATCH_PDA_PREFIX),
            xBuf,
            yBuf,
        ])

        let result = await PublicKey.findProgramAddress([seeds], this.PUBKEY);
        return result[0];
    }

    static async findPlaceStatePda(): Promise<PublicKey> {
        let seeds = Buffer.concat([
            Buffer.from(this.PLACE_STATE_PDA_PREFIX),
        ])

        let result = await PublicKey.findProgramAddress([seeds], this.PUBKEY);
        return result[0];
    }

    static computePatchCoords(x: number, y: number): PixelPatchCoords {

        if (x > PLACE_WIDTH_PX || y > PLACE_HEIGHT_PX || x < 0 || y < 0) {
            throw Error("Invalid pixel coordinates: " + x + "," + y);
        }

        if (Math.floor(x) != x || Math.floor(y) != y) {
            throw Error("non-integer pixel coordinates passed: " + x + "," + y);
        }

        return {
            xPatch: Math.floor(x / PATCH_SIZE_PX),
            yPatch: Math.floor(y / PATCH_SIZE_PX),
            xOffset: x % PATCH_SIZE_PX,
            yOffset: y % PATCH_SIZE_PX,
        }
    }
}