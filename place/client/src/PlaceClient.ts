import { Connection, PublicKey, KeyedAccountInfo, GetProgramAccountsFilter, AccountInfo, Transaction } from "@solana/web3.js";
import { PlaceProgram } from ".";
import { extendBorsh } from "./utils/borsh";
// import { nintendo } from "./palletes/nintendo";
// import { hept32 } from "./palletes/hept32";
import { blend32 } from "./palletes/blend32";
import { PlaceAccountType, PatchData, PlaceStateData } from "./accounts";
import base58 from "bs58";
import { Account, TokenAccount } from "@metaplex-foundation/mpl-core";
import BN from 'bn.js';
import { GameplayTokenMetaAccount } from "./accounts/GameplayTokenMetaAccount";
import { Signal } from 'type-signals';
import { number } from "yargs";
import { MintLayout, Token, MintInfo } from "@solana/spl-token";
import { text } from "stream/consumers";


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

export enum GameplayTokenFetchStatus {
    Found,
    NotFound,
}

export type GameplayTokenFetchResult = {
    status: GameplayTokenFetchStatus,
    // the account holding our metadata related to the NFT
    gameplayTokenAccount: GameplayTokenMetaAccount | null,
    // account that holds the NFT (i.e. has balance of 1)
    tokenAccount: TokenAccount | null,
}

export type GameplayTokenAcctUpdateHandler =
    (owner: PublicKey, gameplayAccounts: GameplayTokenFetchResult[]) => void;

export type PlaceTokenMintUpdateHandler =
    (mintInfo: MintInfo) => void;

export type CurrentUserPlaceTokenAcctsUpdateHandler =
    (tokenAccounts: TokenAccount[] | null) => void;

export class PlaceClient {
    private static instance: PlaceClient;

    private connection: Connection;

    // Subscriptions
    private placePatchesSubscription: number | null = null;
    private placeTokenMintSubscription: number | null = null;
    private currentSlotSubscription: number;
    private currentUserATASubscriptions: number[] | null = null;

    // Signals to expose state changes to react app
    public OnGameplayTokenAcctsDidUpdate = new Signal<GameplayTokenAcctUpdateHandler>();
    public OnPlaceTokenMintUpdated = new Signal<PlaceTokenMintUpdateHandler>();
    public OnCurrentUserPlaceTokenAcctsUpdated = new Signal<CurrentUserPlaceTokenAcctsUpdateHandler>();

    // state that gets updated via various RPC subscriptions
    public currentSlot: number | null = null;
    public currentMintInfo: MintInfo | null = null;
    public currentUser: PublicKey | null = null;
    public currentUserPlaceTokenAccounts: TokenAccount[] | null = null;

    // A buffer containing a color pallete
    // a color pallete is mapping from 8 bit values to full 32 bit color values (RBGA)
    // simply use the 8 bit value, multiplied by 4 to find the index of the mapping
    // for that value
    private colorPallete: Buffer;

    private pallete = blend32;

    // TODO(will): maybe implement a buffer pool to save on alloc's when queuing updates?
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

        // NOTE(will): unsubscribe not handled if we ever destroy this object
        this.currentSlotSubscription =
            this.connection.onSlotChange((slotChange) => {
                this.currentSlot = slotChange.slot
            });

        this.subscribeToPlaceTokenMint();
    }

    // NOTE(will): I think these subscriptions cause CLI commands to hang
    // so currently this is just being called at the end of CLI commands
    public kill() {
        this.connection.removeSlotChangeListener(this.currentSlotSubscription);
        this.unsubscribeFromPatchUpdates()
        this.unsubscribeFromPlaceTokenMint()
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

    public getLargestCurrentUserAta(): TokenAccount | null {
        if (this.currentUserPlaceTokenAccounts === null || this.currentUserPlaceTokenAccounts.length == 0) {
            return null;
        }

        // TODO(will): maybe sort these by amount? maybe try to combine them if user has multiple?

        return this.currentUserPlaceTokenAccounts[0];
    }

    public async packClaimTokensTX(currentUser: PublicKey): Promise<Transaction[] | null> {
        if (currentUser.toBase58() !== this.currentUser.toBase58()) {
            console.log("WARNING: tried to pack claim tx with mismatched user")
            return null;
        }

        if (currentUser === null) {
            console.log("WARNING: tried to pack claim tx for null user");
            return null;
        }

        let ownerCache = this.tokenAccountsCache.get(currentUser.toBase58())
        if (ownerCache === undefined) {
            console.log("WARNING: no gpt token accounts for user: ", currentUser.toBase58());
            return null;
        }


        let claimableGptAccts: GameplayTokenFetchResult[] = []

        for (let [k, v] of ownerCache) {
            if (v.gameplayTokenAccount !== null
                && v.tokenAccount != null
                && v.gameplayTokenAccount.data.place_tokens_owed > 0) {
                claimableGptAccts.push(v);
            }
        }

        if (claimableGptAccts.length == 0) {
            console.log("WARNING: no claimable accounts for user", currentUser.toBase58());
            return null;
        }

        let allTransactions: Transaction[] = []
        let currentTx = new Transaction();
        let destAta = this.getLargestCurrentUserAta();

        let max = 5;

        for (let result of claimableGptAccts) {
            if (currentTx.instructions.length >= max) {
                allTransactions.push(currentTx);
                currentTx = new Transaction();
            }

            let gptAcct = result.gameplayTokenAccount;
            let randomSeed = result.gameplayTokenAccount.data.random_seed
            let gptAta = await PlaceProgram.findGameplayTokenMintAta(gptAcct.data.token_mint_pda, currentUser);
            let ix = await PlaceProgram.claimTokens({
                claimer: currentUser,
                gameplay_token_random_seed: randomSeed,
                gameplay_token_ata: gptAta,
                dest_ata: destAta.pubkey,
            })

            currentTx.add(ix);
        }

        allTransactions.push(currentTx);
        return allTransactions;
    }

    public subscribeToPatchUpdates() {
        extendBorsh();
        if (this.placePatchesSubscription !== null) return;

        console.log("Subscribing to patch updates");
        this.placePatchesSubscription = this.connection.onProgramAccountChange(PlaceProgram.PUBKEY, async (accountInfo, ctx) => {

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

    public unsubscribeFromPatchUpdates() {
        console.log("unsubscribing from patch updates")
        if (this.placePatchesSubscription !== null) {
            this.connection.removeProgramAccountChangeListener(this.placePatchesSubscription);
        }

        this.placePatchesSubscription = null;
    }

    // Set to null to remove subscriptions for a user
    public setCurrentUser(newCurrentUser: PublicKey | null) {
        // this is a fucking atrocity
        let newIsNull = newCurrentUser === null;
        let oldIsNull = this.currentUser === null;
        if (newIsNull && oldIsNull) return;
        let onlyOneNull = (newIsNull && !oldIsNull) || (!newIsNull && oldIsNull); // logical xor
        if (!onlyOneNull && newCurrentUser.toBase58() === this.currentUser.toBase58()) return;

        if (this.currentUser !== null) {
            console.log("Unsubscribing from previous user: ", this.currentUser)
            this.unsubscribeFromCurrentUserPlaceTokenAccounts();
        }

        this.currentUser = newCurrentUser;

        if (this.currentUser !== null) {
            console.log("Subscribing to state for new user: ", this.currentUser.toBase58());
            this.subscribeToCurrentUserPlaceTokenAccounts();
        }
    }


    public async subscribeToPlaceTokenMint() {
        extendBorsh();
        if (this.placeTokenMintSubscription !== null) {
            return;
        }

        let placeMintPDA = await PlaceProgram.findPlaceTokenMintPda();
        let mintAcctInfo = await this.connection.getAccountInfo(placeMintPDA)

        // TODO(will): set up some sort of retry if this fails
        if (mintAcctInfo === null) {
            console.log("WARNING: mint acct info null")
            return;
        }

        let mintInfo = MintLayout.decode(mintAcctInfo.data) as MintInfo
        this.currentMintInfo = mintInfo;

        this.OnPlaceTokenMintUpdated.dispatch(mintInfo);

        console.log("Subscribing to place token mint");
        this.placeTokenMintSubscription = this.connection.onAccountChange(placeMintPDA, async (accountInfo, ctx) => {
            let mintInfo = MintLayout.decode(accountInfo.data) as MintInfo
            console.log("Mint supply: ", mintInfo.supply);
            this.OnPlaceTokenMintUpdated.dispatch(mintInfo);
        })
    }

    public unsubscribeFromPlaceTokenMint() {
        if (this.placeTokenMintSubscription !== null) {
            this.connection.removeAccountChangeListener(this.placeTokenMintSubscription);
        }
        this.placeTokenMintSubscription = null;
    }

    private async subscribeToCurrentUserPlaceTokenAccounts() {

        let currentUser = this.currentUser;
        if (currentUser === null) {
            console.log("WARNING: attempted to subscribe to place token ATAs for null currentuser");
            return;
        }

        let placeMintPDA = await PlaceProgram.findPlaceTokenMintPda();
        let ownerTokenAccounts = await this.connection.getTokenAccountsByOwner(currentUser, {
            mint: placeMintPDA,
        })

        for (let acct of ownerTokenAccounts.value) {
            let acctPubKey = acct.pubkey
            let tokenAcct = new TokenAccount(acctPubKey, acct.account);
            this.updateCurrentUserPlaceTokenAccounts(tokenAcct);
            let sub = this.connection.onAccountChange(acct.pubkey, (acctInfo) => {
                console.log("user place tokens");
                let tokenAccount = new TokenAccount(acctPubKey, acctInfo);
                this.updateCurrentUserPlaceTokenAccounts(tokenAccount);
            })

            if (this.currentUserATASubscriptions === null) {
                this.currentUserATASubscriptions = [sub]
            } else {
                this.currentUserATASubscriptions.push(sub)
            }
        }
    }

    private unsubscribeFromCurrentUserPlaceTokenAccounts() {
        if (this.currentUserATASubscriptions === null) {
            return;
        }

        console.log("Unsubscribing from user place token accounts")

        for (let sub of this.currentUserATASubscriptions) {
            this.connection.removeAccountChangeListener(sub)
        }
    }

    private updateCurrentUserPlaceTokenAccounts(updatedAcct: TokenAccount) {
        if (this.currentUserPlaceTokenAccounts === null) {
            this.currentUserPlaceTokenAccounts = [updatedAcct];
        } else {
            let found = false;
            this.currentUserPlaceTokenAccounts.map((existingAcct) => {
                if (existingAcct.pubkey.toBase58() === updatedAcct.pubkey.toBase58()) {
                    found = true;
                    return updatedAcct;
                } else {
                    return existingAcct;
                }
            })

            if (!found) {
                this.currentUserPlaceTokenAccounts.push(updatedAcct);
            }
        }

        this.OnCurrentUserPlaceTokenAcctsUpdated.dispatch(this.currentUserPlaceTokenAccounts);
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
        this.unsubscribeFromPatchUpdates();
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

    public getTotalClaimableTokensCount(owner: PublicKey): number | null {
        if (owner === null || owner === undefined) return null;
        let ownerCache = this.tokenAccountsCache.get(owner.toBase58())
        if (ownerCache === undefined) return null;

        let claimableTokensCount = 0;

        for (let [k, v] of ownerCache) {
            if (v.gameplayTokenAccount !== null) {
                claimableTokensCount += v.gameplayTokenAccount.data.place_tokens_owed;
            }
        }

        return claimableTokensCount;
    }

    public getSortedGameplayTokenResultsForOwner(owner: PublicKey) {
        if (owner === null || owner === undefined) return [];
        let ownerCache = this.tokenAccountsCache.get(owner.toBase58());
        if (ownerCache === undefined) return [];

        let results: GameplayTokenFetchResult[] = [];
        for (let [k, v] of ownerCache) {
            if (v.gameplayTokenAccount !== null) {
                // TODO(will): could need to handle case where data failed to parse for some reason?
                results.push(v);
            }
        }

        results = results.filter((a) => a.gameplayTokenAccount !== null)

        results.sort((a, b) => {
            return a.gameplayTokenAccount!.data.update_allowed_slot
                .cmp(b.gameplayTokenAccount!.data.update_allowed_slot)
        })

        return results;
    }

    // attempts to refresh a gameplay token from rpc by deleting it from the cache and re-fetching
    public async refreshGameplayToken(owner: PublicKey, token: GameplayTokenMetaAccount) {

        let currentOwnerCache = this.tokenAccountsCache.get(owner.toBase58());
        if (currentOwnerCache !== undefined) {
            let tokenMintPubkey = token.data.token_mint_pda;
            if (tokenMintPubkey === undefined) {
                console.log("Tried to refresh bad token mint");
            } else {
                currentOwnerCache.delete(tokenMintPubkey.toBase58())
            }
        } else {
            console.log("tried to refresh non-existant owner", owner.toBase58());
        }
        this.fetchGameplayTokensForOwner(owner);
    }

    public async fetchGameplayTokensForOwner(owner: PublicKey) {
        let allTokenAccounts = await TokenAccount.getTokenAccountsByOwner(this.connection, owner);
        let nftTokenAccounts = allTokenAccounts
            .filter((acct) => acct.data.amount != new BN(1));
        // let nftMintPubkeys = nftTokenAccounts.map((acct) => acct.data.mint);

        let currentOwnerCache = this.tokenAccountsCache.get(owner.toBase58())

        let nftAccountsToFetch: TokenAccount[] = []

        if (currentOwnerCache !== undefined) {
            // any NFT owned by `owner` that we do not have a cache record for, prepare to fetch it
            for (let nftAcct of nftTokenAccounts) {
                let found = currentOwnerCache.get(nftAcct.data.mint.toBase58()) != undefined
                if (!found) {
                    nftAccountsToFetch.push(nftAcct)
                }
            }
        } else {
            nftAccountsToFetch = nftTokenAccounts;
            currentOwnerCache = new Map()
            this.tokenAccountsCache.set(owner.toBase58(), currentOwnerCache);
        }

        console.log("found ", nftTokenAccounts.length, " NFT mints, fetching: ", nftAccountsToFetch.length);

        // NOTE(will): theres a lot of potential for cache corruption here
        // i.e. user buys a gameplay token, fetch happens, but RPC nodes don't find newly minted
        // gameplay token for whatever reason, cache record exists but as NotFound

        // TODO(will): there some edge cases here to think about, like if account fails to parse
        // for some reason and cache corruption

        for (const nftAcct of nftAccountsToFetch) {
            let gameplayTokenAccount = await PlaceProgram.getProgramAccounts(this.connection, {
                commitment: "recent",
                filters: [
                    {
                        memcmp: {
                            bytes: nftAcct.data.mint.toBase58(),
                            offset: 1 + 1 + 8 + 8,
                        }
                    }
                ]
            });

            if (gameplayTokenAccount.length == 0) {
                currentOwnerCache.set(nftAcct.data.mint.toBase58(), {
                    status: GameplayTokenFetchStatus.NotFound,
                    gameplayTokenAccount: null,
                    tokenAccount: null,
                })
            } else {
                let accountInfo = gameplayTokenAccount[0];
                let account = new GameplayTokenMetaAccount(accountInfo.pubkey, accountInfo.info)

                currentOwnerCache.set(nftAcct.data.mint.toBase58(), {
                    status: GameplayTokenFetchStatus.Found,
                    gameplayTokenAccount: account,
                    tokenAccount: nftAcct,
                })
            }
        }

        let sorted = this.getSortedGameplayTokenResultsForOwner(owner);
        console.log("dispatching gameplay tokens update");
        this.OnGameplayTokenAcctsDidUpdate.dispatch(owner, sorted);
    }
}