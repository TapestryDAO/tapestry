import { Connection, PublicKey, KeyedAccountInfo } from "@solana/web3.js";
import { Signal } from 'type-signals';
import { PlaceProgram } from ".";
import { PatchData } from "./accounts/Patch";
import { extendBorsh } from "./utils/borsh";
import { pallete } from "./Pallete";


const makeKey = (patch: PatchData): string => {
    return "" + patch.x + "," + patch.y;
}

export class PlaceClient {
    private static instance: PlaceClient;

    private connection: Connection;

    private didSubscribe = false
    private subscription: number | null = null;

    // A buffer containing a color pallete
    // a color pallete is mapping from 8 bit values to full 32 bit color values (RBGA)
    // simply use the 8 bit value, multiplied by 4 to find the index of the mapping
    // for that value
    private colorPallete: Buffer;

    constructor(connection: Connection) {
        this.connection = connection;

        let bufSize = pallete.length * 4;
        let buf = Buffer.alloc(bufSize);

        var counter = 0;
        for (const color of pallete) {
            let rString = color.substring(0, 2);
            let gString = color.substring(2, 4);
            let bString = color.substring(4, 6);

            let rValue = parseInt(rString, 16);
            let gValue = parseInt(gString, 16);
            let bValue = parseInt(bString, 16);

            let bufOffset = counter * 4
            buf.writeUInt8(rValue, bufOffset);
            buf.writeUInt8(gValue, bufOffset + 1);
            buf.writeUInt8(bValue, bufOffset + 2);
            buf.writeUInt8(255, bufOffset + 3); // 0 or 255 for alpha?
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
        if (this.didSubscribe) return;
        this.didSubscribe = true;

        console.log("Subscribing to patch updates");
        this.subscription = this.connection.onProgramAccountChange(PlaceProgram.PUBKEY, async (accountInfo, ctx) => {

            let data = accountInfo.accountInfo.data;
            if (data !== undefined) {
                let patch = PatchData.deserialize(accountInfo.accountInfo.data)
                console.log("PATCH: ", patch.x, patch.y);
            }

            console.log("got update for account: ", accountInfo.accountId);
        });
    }

    public async fetchAllPatches() {
        extendBorsh();
        this.connection.removeProgramAccountChangeListener(this.subscription);
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

        let mapOfAccounts = new Map<string, PatchData>();

        for (const account of allAccountsParsed) {
            mapOfAccounts.set(makeKey(account), account);
        }

        let settings: ImageDataSettings = { colorSpace: "srgb" };
        let data = new ImageData(1920, 1080, settings);

        let buf = Buffer.alloc(5);
        buf.writeUInt8(5);
        console.log(buf[0]);

        for (let y = 0; y < (1080 / 40); y++) {
            for (let x = 0; x < (1920 / 40); x++) {

            }
        }
    }

    // So I think the move here is:
    // 1. subscribe to account updates using connection.onProgramAccountChange()
    // 2. build accounts into a large bitmap
    // 3. update update bitamp and redraw as new chunks load
    // 4. May need to either generate a map from pda to x,y or put that data in the account data
}