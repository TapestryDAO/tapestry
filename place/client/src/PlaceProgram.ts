import {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
} from '@solana/web3.js'
import { Program } from '@metaplex-foundation/mpl-core'
import { SetPixelArgsData, PixelColorData } from './instructions/setPixel';

export const PLACE_HEIGHT_PX = 1080;
export const PLACE_WIDTH_PX = 1920;
export const PATCH_SIZE_PX = 40;
export const PIXEL_SIZE_BYTES = 3;

export type SetPixelParams = {
    x: number,
    y: number,
    pixel: number[],
    payer: PublicKey,
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

    static async setPixel(params: SetPixelParams) {
        let patchCoords = this.computePatchCoords(params.x, params.y);

        let pixelData = new PixelColorData({
            r: params.pixel[0],
            g: params.pixel[1],
            b: params.pixel[2],
        });

        let data = SetPixelArgsData.serialize({
            x: patchCoords.xPatch,
            y: patchCoords.yPatch,
            x_offset: patchCoords.xOffset,
            y_offset: patchCoords.yOffset,
            pixel: pixelData,
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

    static computePatchCoords(x: number, y: number): PixelPatchCoords {

        if (x > PLACE_WIDTH_PX || y > PLACE_HEIGHT_PX) {
            throw Error("Invalid pixel coordinates: " + x + "," + y);
        }

        if (Math.floor(x) != x || Math.floor(y) != y) {
            throw Error("non-integer pixel coordinates passed: " + x + "," + y);
        }


        return {
            xPatch: Math.floor(x / PATCH_SIZE_PX),
            yPatch: Math.floor(y / PATCH_SIZE_PX),
            xOffset: x % PATCH_SIZE_PX,
            yOffset: x % PATCH_SIZE_PX,
        }
    }
}