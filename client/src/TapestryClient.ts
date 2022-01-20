import { Connection, PublicKey, KeyedAccountInfo } from "@solana/web3.js";
import { TapestryProgram, TokenAccountsCache } from ".";
import { MaybeTapestryPatchAccount, TapestryPatchAccount, TapestryChunk } from "./accounts/TapestryPatch";
import { Signal } from 'type-signals';


type ChunkUdateHandler = (chunk: TapestryChunk) => void;

const chunkKey = (xChunk: number, yChunk: number): string => {
    return "" + xChunk + "," + yChunk;
}

/**
 * Thinking of this as an abstraction over the caching of accounts and data.
 * Unsure if this is the right abstaction but will proceed for now...
 */
export class TapestryClient {
    private static instance: TapestryClient;

    private connection: Connection;

    // Cache used to determine if a public key is the owner of a patch
    private tokenAccountsCache: TokenAccountsCache;

    private chunkCache = new Map<string, TapestryChunk>();

    // UGHHH - this stores all the in flight requests we have because react fucking renders everything 
    // a million mother fucking times, meaning we inadvertantly stack fucking requests for the same fucking patch
    private inFlightChunkFetch = new Map<string, Promise<TapestryChunk>>();

    public OnChunkUpdate = new Signal<ChunkUdateHandler>();

    private constructor(connection: Connection) {
        this.connection = connection
        this.tokenAccountsCache = new TokenAccountsCache();
        // this.subscribeToPatchUpdates()
    }

    public static getInstance(): TapestryClient {
        if (!TapestryClient.instance) {
            this.instance = new TapestryClient(
                new Connection("http://127.0.0.1:8899"));
        }

        return this.instance;
    }

    private updateCache(chunk: TapestryChunk) {
        this.chunkCache.set(chunkKey(chunk.xChunk, chunk.yChunk), chunk)
        this.OnChunkUpdate.dispatch(chunk)
    }

    // NOTE(will): Unforunately this will initially fetch all the patches unless a filter is provided
    // this results in overloading the image decoder and a bunch of failures, so it doesn't work as a 
    // way to recieve patch updates live at the moment

    // private subscribeToPatchUpdates() {
    //     console.log("Subscribing to program account updates")
    //     this.connection.onProgramAccountChange(TapestryProgram.PUBKEY, async (accountInfo, ctx) => {
    //         let account = new TapestryPatchAccount(accountInfo.accountId, accountInfo.accountInfo)
    //         console.log("Got update for patch: ", account.data.x, account.data.y)
    //         let cachedChunk = this.chunkCache.get(chunkKey(account.data.x_chunk, account.data.y_chunk))

    //         if (cachedChunk === undefined) {
    //             // Ignore updates for unloaded chunks?
    //             return
    //         }

    //         account.loadBitmap().then((accountWithBitmap) => {
    //             cachedChunk.updatePatch(accountWithBitmap)
    //             this.updateCache(cachedChunk)
    //         })
    //     })
    // }

    private getConnection() {
        return this.connection
    }

    public setConnection(connection: Connection) {
        this.connection = connection
        // this.subscribeToPatchUpdates()
    }

    public forceTokenAccountsCacheRefresh(owner: PublicKey) {
        this.tokenAccountsCache.refreshCache(this.connection, owner, true)
    }

    // Returns undefined if 
    public isPatchOwnedBy(patch: PublicKey, owner: PublicKey, cacheRefreshCallback?: (result: boolean) => void): boolean {
        const cacheIsOwned = this.tokenAccountsCache.isPatchOwned(patch, owner)
        if (cacheIsOwned !== undefined) {
            return cacheIsOwned
        } else if (cacheRefreshCallback !== undefined) {
            this.tokenAccountsCache.refreshCache(this.connection, owner).then(() => {
                const cacheIsOwned = this.tokenAccountsCache.isPatchOwned(patch, owner)
                if (cacheIsOwned === undefined) {
                    console.log("Unexpected cache miss!")
                }

                cacheRefreshCallback(cacheIsOwned ?? false)
            })
        }

        return false;
    }

    /// TODO:
    //
    // 1. pre-load image and store on patches
    // 2. pub sub at the chunk level
    // 2.5 sub to accounts owned by main program account
    // 3. have the chunk components diff (if needed, might not actually be needed)
    // 4. keep a cache of chunks
    // 5. allow invaldation of cache on updates
    // 6. show hover text on patches

    public async fetchChunkArray(xChunk: number, yChunk: number): Promise<MaybeTapestryPatchAccount[][]> {
        let result = await this.connection.getProgramAccounts(TapestryProgram.PUBKEY, {
            filters: TapestryPatchAccount.getChunkFilters(xChunk, yChunk)
        })

        let accounts = result.map((value) => {
            return new TapestryPatchAccount(value.pubkey, value.account)
        })
        return TapestryPatchAccount.organizeChunk(accounts)
    }

    // Will return a loaded chunk from cache if it has one, otherwise will return an empty chunk immediately
    // and fetch the desired chunk, callers of this can subscribe to the OnChunkUpdate signal to get the result
    // of the fetch
    public fetchChunk2(xChunk: number, yChunk: number, loadBitmaps: boolean = true, force: boolean = false): TapestryChunk {

        const cachedChunk = this.chunkCache.get(chunkKey(xChunk, yChunk));

        if (cachedChunk !== undefined && !force) {
            return cachedChunk
        }

        const inFlight = this.inFlightChunkFetch.get(chunkKey(xChunk, yChunk));

        if (inFlight !== undefined) {
            console.log("Bailing because we had in flight")
            return TapestryChunk.getNullChunk(xChunk, yChunk);
        }

        let chunkPromise = this.connection.getProgramAccounts(TapestryProgram.PUBKEY, {
            filters: TapestryPatchAccount.getChunkFilters(xChunk, yChunk)
        }).then((result) => {
            return result.map((value) => {
                return new TapestryPatchAccount(value.pubkey, value.account)
            }).map((account) => {
                if (!loadBitmaps) {
                    return Promise.resolve(account)
                } else {
                    return account.loadBitmap()
                }
            })
        }).then(async (accounts) => {
            let accountsResolved = await Promise.all(accounts)
            let chunk = new TapestryChunk(xChunk, yChunk, accountsResolved);
            console.log("Udating Cache: ", xChunk, yChunk);
            this.updateCache(chunk);
            this.inFlightChunkFetch.delete(chunkKey(xChunk, yChunk))
            return chunk
        })

        this.inFlightChunkFetch.set(chunkKey(xChunk, yChunk), chunkPromise)

        return TapestryChunk.getNullChunk(xChunk, yChunk);
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
        }).map((account) => {
            let imageData = account.data.image_data
            if (imageData !== undefined) {
                try {
                    let buffer = new Uint8Array(imageData)
                    let blob = new Blob([buffer], { type: "image/gif" })
                    return createImageBitmap(blob).then((value) => {
                        account.image_bitmap = value
                        return account
                    })
                } catch (error) {
                    console.log("image decoding failed: ", error)
                    return Promise.resolve(account)
                }
            } else {
                return Promise.resolve(account)
            }
        })

        let accountsResolved = await Promise.all(accounts)

        return new TapestryChunk(xChunk, yChunk, accountsResolved)
    }
}