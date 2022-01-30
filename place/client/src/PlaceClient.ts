import { Connection, PublicKey, KeyedAccountInfo } from "@solana/web3.js";
import { Signal } from 'type-signals';
import { PlaceProgram } from ".";

export class PlaceClient {
    private static instance: PlaceClient;

    private connection: Connection;

    private didSubscribe = false

    constructor(connection: Connection) {
        this.connection = connection;
    }

    public static getInstance(): PlaceClient {
        if (!PlaceClient.instance) {
            this.instance = new PlaceClient(new Connection("http://127.0.0.1:8899"))
        }

        return this.instance;
    }

    public subscribeToPatchUpdates() {
        if (this.didSubscribe) return;
        this.didSubscribe = true;

        console.log("Subscribing to patch updates");
        this.connection.onProgramAccountChange(PlaceProgram.PUBKEY, async (accountInfo, ctx) => {
            console.log("got update for account: ", accountInfo.accountId);
        });
    }

    // So I think the move here is:
    // 1. subscribe to account updates using connection.onProgramAccountChange()
    // 2. build accounts into a large bitmap
    // 3. update update bitamp and redraw as new chunks load
    // 4. May need to either generate a map from pda to x,y or put that data in the account data
}