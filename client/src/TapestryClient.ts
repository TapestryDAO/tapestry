import { Connection } from "@solana/web3.js";
import { number } from "yargs";
import { TapestryProgram } from ".";
import { MaybeTapestryPatchAccount, TapestryPatchAccount, TapestryChunk } from "./accounts/TapestryPatch";

/**
 * Thinking of this as an abstraction over the caching of accounts and data.
 * Unsure if this is the right abstaction but will proceed for now...
 */
export class TapestryClient {
    private static instance: TapestryClient;

    private connection: Connection

    private constructor(connection: Connection) {
        this.connection = connection
    }

    public static getInstance(): TapestryClient {
        if (!TapestryClient.instance) {
            this.instance = new TapestryClient(
                new Connection("http://127.0.0.1:8899"));
        }

        return this.instance;
    }

    private getConnection() {
        return this.connection
    }

    public setConnection(connection: Connection) {
        // this.connection = connection
    }

    public async fetchChunkArray(xChunk: number, yChunk: number): Promise<MaybeTapestryPatchAccount[][]> {
        let result = await this.connection.getProgramAccounts(TapestryProgram.PUBKEY, {
            filters: TapestryPatchAccount.getChunkFilters(xChunk, yChunk)
        })

        let accounts = result.map((value) => {
            return new TapestryPatchAccount(value.pubkey, value.account)
        })
        return TapestryPatchAccount.organizeChunk(accounts)
    }

    public async fetchChunk(xChunk: number, yChunk: number): Promise<TapestryChunk> {
        let result = await this.connection.getProgramAccounts(TapestryProgram.PUBKEY, {
            filters: TapestryPatchAccount.getChunkFilters(xChunk, yChunk)
        })

        let accounts = result.map((value) => {
            return new TapestryPatchAccount(value.pubkey, value.account)
        })

        return new TapestryChunk(xChunk, yChunk, accounts)
    }

    public static async fetchChunk(connection: Connection, xChunk: number, yChunk: number): Promise<TapestryChunk> {
        let result = await connection.getProgramAccounts(TapestryProgram.PUBKEY, {
            filters: TapestryPatchAccount.getChunkFilters(xChunk, yChunk)
        })

        let accounts = result.map((value) => {
            return new TapestryPatchAccount(value.pubkey, value.account)
        })

        return new TapestryChunk(xChunk, yChunk, accounts)
    }
}