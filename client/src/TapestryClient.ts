import { Connection } from "@solana/web3.js";
import { TapestryProgram } from ".";
import { MaybeTapestryPatchAccount, TapestryPatchAccount } from "./accounts/TapestryPatch";


/**
 * Thinking of this as an abstraction over the caching of accounts and data.
 * Unsure if this is the right abstaction but will proceed for now...
 */
export class TapestryClient {
    private static instance: TapestryClient;

    private endpoint: string

    private constructor(endpoint: string) {
        this.endpoint = endpoint
    }

    public static getInstance(): TapestryClient {
        if (!TapestryClient.instance) {
            this.instance = new TapestryClient("http://127.0.0.1:8899");
        }

        return this.instance;
    }

    public async fetchChunk(xChunk: number, yChunk: number): Promise<MaybeTapestryPatchAccount[][]> {
        let connection = new Connection(this.endpoint, "confirmed")
        let result = await connection.getProgramAccounts(TapestryProgram.PUBKEY, {
            filters: TapestryPatchAccount.getChunkFilters(xChunk, yChunk)
        })

        let accounts = result.map((value) => {
            return new TapestryPatchAccount(value.pubkey, value.account)
        })
        return TapestryPatchAccount.organizeChunk(accounts)
    }
}