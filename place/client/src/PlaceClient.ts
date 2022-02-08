import { Connection, PublicKey, KeyedAccountInfo, GetProgramAccountsFilter } from "@solana/web3.js";
import { PlaceProgram } from ".";
import { extendBorsh } from "./utils/borsh";
// import { nintendo } from "./palletes/nintendo";
// import { hept32 } from "./palletes/hept32";
import { blend32 } from "./palletes/blend32";
import { PlaceAccountType, PatchData, PlaceStateData } from "./accounts";
import base58 from "bs58";
import { inspect } from "util";
import { Account, TokenAccount } from "@metaplex-foundation/mpl-core";
import BN from 'bn.js';
import { GameplayTokenMetaAccount } from "./accounts/GameplayTokenMetaAccount";
import { runInThisContext } from "vm";
import { kill } from "process";

export const PATCH_WIDTH = 20;
export const PATCH_HEIGHT = 20;

export type CanvasUpdate = {
    x: number,
    y: number,
    width: number,
    height: number,
    image: Uint8ClampedArray,
};

type PublicKeyB58 = string;

enum GameplayTokenFetchStatus {
    Found,
    NotFound,
}

type GameplayTokenFetchResult = {
    status: GameplayTokenFetchStatus,
    gameplayTokenAccount: GameplayTokenMetaAccount | null
}

export class PlaceClient {
    private static instance: PlaceClient;

    private connection: Connection;
    private subscription: number | null = null;

    // A buffer containing a color pallete
    // a color pallete is mapping from 8 bit values to full 32 bit color values (RBGA)
    // simply use the 8 bit value, multiplied by 4 to find the index of the mapping
    // for that value
    private colorPallete: Buffer;

    private pallete = blend32;

    public updatesQueue: CanvasUpdate[] = [];

    // ownerPubkey -> (mintPubkey -> GameplayTokenFetchResult)
    private tokenAccountsCache: Map<PublicKeyB58, Map<PublicKeyB58, GameplayTokenFetchResult>> = new Map();

    private patchAccountsFilter: GetProgramAccountsFilter = {
        memcmp: {
            bytes: base58.encode([PlaceAccountType.Patch]),
            offset: 0,
        }
    }

    private placeStateAccountsFilter: GetProgramAccountsFilter = {
        memcmp: {
            bytes: base58.encode([PlaceAccountType.PlaceState]),
            offset: 0,
        }
    }

    constructor(connection: Connection) {
        this.connection = connection;

        let bufSize = this.pallete.length * 4;
        let buf = Buffer.alloc(bufSize);

        var bufOffset = 0;
        for (const color of this.pallete) {
            let rString = color.substring(0, 2);
            let gString = color.substring(2, 4);
            let bString = color.substring(4, 6);

            let rValue = parseInt(rString, 16);
            let gValue = parseInt(gString, 16);
            let bValue = parseInt(bString, 16);

            // console.log("Offset: ", bufOffset, " Color: ", rValue, gValue, bValue);

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

    // Returns all colors in the pallete as hex strings
    public getColorPalleteHex(): string[] {
        let palleteColors: string[] = []
        for (let i = 0; i < this.colorPallete.length; i = i + 4) {
            let r = this.colorPallete[i];
            let g = this.colorPallete[i + 1];
            let b = this.colorPallete[i + 2];
            // ignore alpha

            let hex = ((b | g << 8 | r << 16) | 1 << 24).toString(16).slice(1)
            palleteColors.push("#" + hex);
        }

        return palleteColors;
    }

    // #ffffff string -> uint8 
    public pixelColorToPalletColor(rgb: string): number {

        let offset = 0;
        if (rgb.startsWith("#")) {
            offset += 1;
        }

        console.log("OFFSET: ", offset);

        let r = rgb.substring(offset, offset += 2);
        let g = rgb.substring(offset, offset += 2);
        let b = rgb.substring(offset, offset += 2);
        let rValue = parseInt(r, 16);
        let gValue = parseInt(g, 16);
        let bValue = parseInt(b, 16);
        let aValue = 255;

        for (let i = 0; i < this.colorPallete.length; i = i + 4) {
            if (this.colorPallete[i] == rValue
                && this.colorPallete[i + 1] == gValue
                && this.colorPallete[i + 2] == bValue) {
                return i / 4;
            }
        }

        console.log("COLOR NOT FOUND");

        return 0;
    }

    public subscribeToPatchUpdates() {
        extendBorsh();
        if (this.subscription != null) return;

        console.log("Subscribing to patch updates");
        this.subscription = this.connection.onProgramAccountChange(PlaceProgram.PUBKEY, async (accountInfo, ctx) => {

            let data = accountInfo.accountInfo.data;
            if (data !== undefined) {
                let patch = PatchData.deserialize(accountInfo.accountInfo.data)
                // console.log("GOT PATCH: ", patch.x, patch.y);
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
        }, "processed", [this.patchAccountsFilter]);
    }

    public patchAccountToPixels(acct: PatchData): Uint8ClampedArray {
        let array = new Uint8ClampedArray(PATCH_HEIGHT * PATCH_WIDTH * 4);

        // console.log("pixels length: ", acct.pixels.length);

        let offset = 0;
        for (let i = 0; i < acct.pixels.length; i++) {
            const pixel8Bit = acct.pixels.readUInt8(i);
            let colorOffset = pixel8Bit * 4
            if (this.colorPallete.length >= colorOffset + 4) {
                let pixelValueArr = this.colorPallete.slice(colorOffset, colorOffset + 4)
                // console.log(pixelValueArr);
                array.set(pixelValueArr, offset);
            } else {
                // console.log("Invalid color for pallete: ", pixel8Bit);
                // fallback to the "zero" color
                let pixelValueArr = this.colorPallete.slice(0, 4)
                array.set(pixelValueArr, offset);
            }

            offset = offset + 4;
        }

        // console.log("array: ", array);

        return array;
    }

    public async fetchPlaceStateAccount(): Promise<PlaceStateData> {
        extendBorsh();
        const config = { filters: [this.placeStateAccountsFilter] };
        let results = await this.connection.getProgramAccounts(PlaceProgram.PUBKEY, config)
        if (results.length !== 1) {
            console.log("WARNING: Unexpected number of state accounts: ", results.length);
        }

        let result = results[0];
        return PlaceStateData.deserialize(result.account.data);
    }

    public async fetchAllPatches() {
        extendBorsh();
        if (this.subscription !== null) {
            this.connection.removeProgramAccountChangeListener(this.subscription);
        }

        this.subscription = null;
        const config = { filters: [this.patchAccountsFilter] }
        let allAccounts = await this.connection.getProgramAccounts(PlaceProgram.PUBKEY, config);
        let allAccountsParsed = allAccounts.flatMap((value) => {
            let data = value.account.data;
            if (data != undefined) {
                return PatchData.deserialize(data) as PatchData;
            } else {
                return null;
            }
        });

        for (const acct of allAccountsParsed) {
            if (acct == null) {
                continue;
            }

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

    public getSortedGameplayTokensForOwner(owner: PublicKey): GameplayTokenMetaAccount[] {
        if (owner === null || owner === undefined) return [];
        let ownerCache = this.tokenAccountsCache.get(owner.toBase58());
        if (ownerCache === undefined) return [];

        let metaAccounts: GameplayTokenMetaAccount[] = []
        for (let [k, v] of ownerCache) {
            if (v.gameplayTokenAccount !== null) {
                // TODO(will): could need to handle case where data failed to parse for some reason?
                metaAccounts.push(v.gameplayTokenAccount);
            }
        }

        metaAccounts.sort((a, b) => a.data.update_allowed_slot.cmp(b.data.update_allowed_slot))
        return metaAccounts;
    }

    public async fetchGameplayTokensForOwner(owner: PublicKey): Promise<GameplayTokenMetaAccount[]> {
        let allTokenAccounts = await TokenAccount.getTokenAccountsByOwner(this.connection, owner);
        let nftTokenAccounts = allTokenAccounts
            .filter((acct) => acct.data.amount != new BN(1));
        let nftMintPubkeys = nftTokenAccounts.map((acct) => acct.data.mint);

        let currentOwnerCache = this.tokenAccountsCache.get(owner.toBase58())

        let nftsToFetch: PublicKey[] = []

        if (currentOwnerCache !== undefined) {
            // any NFT owned by `owner` that we do not have a cache record for, prepare to fetch it
            for (let nftMintKey of nftMintPubkeys) {
                let found = currentOwnerCache.get(nftMintKey.toBase58()) != undefined
                if (!found) {
                    nftsToFetch.push(nftMintKey)
                }
            }
        } else {
            nftsToFetch = nftMintPubkeys;
            currentOwnerCache = new Map()
            this.tokenAccountsCache.set(owner.toBase58(), currentOwnerCache);
        }

        console.log("found ", nftMintPubkeys.length, " NFT mints, fetching: ", nftsToFetch.length);

        // NOTE(will): theres a lot of potential for cache corruption here
        // i.e. user buys a gameplay token, fetch happens, but RPC nodes don't find newly minted
        // gameplay token for whatever reason, cache record exists but as NotFound

        // TODO(will): there some edge cases here to think about, like if account fails to parse
        // for some reason and cache corruption

        for (const pubkey of nftsToFetch) {
            let gameplayTokenAccount = await PlaceProgram.getProgramAccounts(this.connection, {
                commitment: "recent",
                filters: [
                    {
                        memcmp: {
                            bytes: pubkey.toBase58(),
                            offset: 1 + 1 + 8 + 8,
                        }
                    }
                ]
            });

            if (gameplayTokenAccount.length == 0) {
                currentOwnerCache.set(pubkey.toBase58(), {
                    status: GameplayTokenFetchStatus.NotFound,
                    gameplayTokenAccount: null,
                })
            } else {
                let accountInfo = gameplayTokenAccount[0];
                let account = new GameplayTokenMetaAccount(accountInfo.pubkey, accountInfo.info)

                currentOwnerCache.set(pubkey.toBase58(), {
                    status: GameplayTokenFetchStatus.Found,
                    gameplayTokenAccount: account,
                })
            }
        }

        return this.getSortedGameplayTokensForOwner(owner);

        // [check] 1. cache results of this function
        // [     ] 2. show how many paintbrushes user has in the UI
        // [     ] 3. implement set pixel, checking cooldown
        // [     ] 4. distribute tapestry tokens from set pixel instruction
        // [     ] 5. show in UI how long until next paintbrush has finished cooldown
    }
}