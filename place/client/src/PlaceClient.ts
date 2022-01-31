import { Connection, PublicKey, KeyedAccountInfo } from "@solana/web3.js";
import { Signal } from 'type-signals';
import { PlaceProgram } from ".";
import { PatchData } from "./accounts/Patch";
import { extendBorsh } from "./utils/borsh";
import { pallete } from "./Pallete";

export const PATCH_WIDTH = 40;
export const PATCH_HEIGHT = 40;

export type CanvasUpdate = {
    x: number,
    y: number,
    width: number,
    height: number,
    image: Uint8ClampedArray,
};

export class PlaceClient {
    private static instance: PlaceClient;

    private connection: Connection;
    private subscription: number | null = null;

    // A buffer containing a color pallete
    // a color pallete is mapping from 8 bit values to full 32 bit color values (RBGA)
    // simply use the 8 bit value, multiplied by 4 to find the index of the mapping
    // for that value
    private colorPallete: Buffer;

    public updatesQueue: CanvasUpdate[] = [];

    constructor(connection: Connection) {
        this.connection = connection;

        let bufSize = pallete.length * 4;
        let buf = Buffer.alloc(bufSize);

        var bufOffset = 0;
        for (const color of pallete) {
            let rString = color.substring(0, 2);
            let gString = color.substring(2, 4);
            let bString = color.substring(4, 6);

            let rValue = parseInt(rString, 16);
            let gValue = parseInt(gString, 16);
            let bValue = parseInt(bString, 16);

            console.log("Offset: ", bufOffset, " Color: ", rValue, gValue, bValue);

            buf.writeUInt8(rValue, bufOffset);
            buf.writeUInt8(gValue, bufOffset + 1);
            buf.writeUInt8(bValue, bufOffset + 2);
            buf.writeUInt8(255, bufOffset + 3); // 0 or 255 for alpha?

            bufOffset += 4;
        }

        this.colorPallete = buf
    }

    public static getInstance(): PlaceClient {
        if (!PlaceClient.instance) {
            this.instance = new PlaceClient(new Connection("http://127.0.0.1:8899"))
        }

        return this.instance;
    }

    public subscribeToPatchUpdates() {
        extendBorsh();
        if (this.subscription != null) return;

        console.log("Subscribing to patch updates");
        this.subscription = this.connection.onProgramAccountChange(PlaceProgram.PUBKEY, async (accountInfo, ctx) => {

            let data = accountInfo.accountInfo.data;
            if (data !== undefined) {
                let patch = PatchData.deserialize(accountInfo.accountInfo.data)
                console.log("GOT PATCH: ", patch.x, patch.y);
                this.updatesQueue.push({
                    x: patch.x * PATCH_WIDTH,
                    y: patch.y * PATCH_HEIGHT,
                    width: PATCH_WIDTH,
                    height: PATCH_HEIGHT,
                    image: this.patchAccountToPixels(patch)
                })
            } else {
                console.log("got update for account: ", accountInfo.accountId);
            }
        });
    }

    public patchAccountToPixels(acct: PatchData): Uint8ClampedArray {
        let array = new Uint8ClampedArray(PATCH_HEIGHT * PATCH_WIDTH * 4);

        let offset = 0;
        for (const pixel8Bit of acct.pixels) {
            let colorOffset = pixel8Bit * 4
            let pixelValueArr = this.colorPallete.slice(colorOffset, colorOffset + 4)
            // console.log(pixelValueArr);
            array.set(pixelValueArr, offset);
            offset = offset + 4;
        }

        // console.log("array: ", array);

        return array;
    }

    public async fetchAllPatches() {
        extendBorsh();
        if (this.subscription !== null) {
            this.connection.removeProgramAccountChangeListener(this.subscription);
        }

        this.subscription = null;
        let allAccounts = await this.connection.getProgramAccounts(PlaceProgram.PUBKEY);
        let allAccountsParsed = allAccounts.flatMap((value) => {
            let data = value.account.data;
            if (data != undefined) {
                return PatchData.deserialize(data) as PatchData;
            } else {
                return null;
            }
        });

        for (const acct of allAccountsParsed) {
            this.updatesQueue.push({
                x: acct.x * PATCH_WIDTH,
                y: acct.y * PATCH_HEIGHT,
                width: PATCH_WIDTH,
                height: PATCH_HEIGHT,
                image: this.patchAccountToPixels(acct),
            })
        }

        this.subscribeToPatchUpdates();
    }
}