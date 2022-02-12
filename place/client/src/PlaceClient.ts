import { Connection, PublicKey, KeyedAccountInfo, GetProgramAccountsFilter, AccountInfo, Transaction, TransactionSignature, TransactionInstruction } from "@solana/web3.js";
import { PlaceProgram } from ".";
import { extendBorsh } from "./utils/borsh";
import { blend32 } from "./palletes/blend32";
import { PlaceAccountType, PatchData, PlaceStateData } from "./accounts";
import base58 from "bs58";
import { TokenAccount } from "@metaplex-foundation/mpl-core";
import BN from 'bn.js';
import { GameplayTokenMetaAccount } from "./accounts/GameplayTokenMetaAccount";
import { Signal } from './signals';
import { MintLayout, Token, MintInfo, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

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

export type GameplayTokenRecord = {
    mintPubkey: PublicKeyB58,
    gameplayTokenMetaAcct: GameplayTokenMetaAccount,
    userTokenAccount: TokenAccount,
    _userTokenAccountSubscription: number | null,
    _gptAccountSubscription: number | null,
}

export type AwaitingGptRecord = {
    gptMintPubkey: PublicKey,
    gptAtaPubkey: PublicKey,
    gptMetaPubkey: PublicKey,
    gptMetaAccount: GameplayTokenMetaAccount | null;
    gptAtaAccount: TokenAccount | null;
    gptAtaSubscription: number,
    gptMetaSubscription: number,
}

export type GameplayTokenRecordsHandler =
    (records: GameplayTokenRecord[]) => void;

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
    public OnPlaceTokenMintUpdated = new Signal<PlaceTokenMintUpdateHandler>();
    public OnCurrentUserPlaceTokenAcctsUpdated = new Signal<CurrentUserPlaceTokenAcctsUpdateHandler>();
    public OnGameplayTokenRecordsUpdated = new Signal<GameplayTokenRecordsHandler>();

    // current state updated via various RPC subscriptions
    public currentSlot: number | null = null;
    public currentMintInfo: MintInfo | null = null;
    public currentUser: PublicKey | null = null;
    public currentUserPlaceTokenAccounts: TokenAccount[] | null = null;
    public currentUserGptRecords: GameplayTokenRecord[] | null = null;
    public awaitingGptRecords: AwaitingGptRecord[] = []

    // A buffer containing a color pallete
    // a color pallete is mapping from 8 bit values to full 32 bit color values (RBGA)
    // simply use the 8 bit value, multiplied by 4 to find the index of the mapping
    // for that value
    private colorPallete: Buffer;
    private pallete = blend32;

    // TODO(will): maybe implement a buffer pool to save on alloc's when queuing updates?
    public updatesQueue: CanvasUpdate[] = [];

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

    public async packClaimTokensTX(): Promise<Transaction[] | null> {
        if (this.currentUser === null) {
            console.log("WARNING: tried to pack claim tx but current user was null")
            return null;
        }

        if (this.currentUserGptRecords === null) {
            console.log("WARNING: tried to pack claim tx but had no user gpt records")
            return null;
        }

        let claimableGptAccts: GameplayTokenRecord[] = []

        for (let record of this.currentUserGptRecords) {
            if (record.gameplayTokenMetaAcct.data.place_tokens_owed > 0) {
                claimableGptAccts.push(record);
            }
        }

        if (claimableGptAccts.length == 0) {
            console.log("WARNING: no claimable accounts for user", this.currentUser.toBase58());
            return null;
        }

        let allTransactions: Transaction[] = []
        let currentTx = new Transaction();
        let destAta = this.getLargestCurrentUserAta();
        let destAtaPubkey: PublicKey;

        // if this user doesn't have an ata, create one
        if (destAta === null) {
            let placeTokenMintPda = await PlaceProgram.findPlaceTokenMintPda();
            destAtaPubkey = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                placeTokenMintPda,
                this.currentUser,
                false,
            );

            let create_ata_ix = Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                placeTokenMintPda,
                destAtaPubkey,
                this.currentUser,
                this.currentUser,
            )
            currentTx.add(create_ata_ix);

            // TODO(will): subscribe to updates for this account so we can propagate state to UI
        } else {
            destAtaPubkey = destAta.pubkey;
        }

        let max = 6;

        for (let result of claimableGptAccts) {
            if (currentTx.instructions.length > max) {
                allTransactions.push(currentTx);
                currentTx = new Transaction();
            }

            let gptAcct = result.gameplayTokenMetaAcct;
            let randomSeed = result.gameplayTokenMetaAcct.data.random_seed
            let gptAta = await PlaceProgram.findGameplayTokenMintAta(gptAcct.data.token_mint_pda, this.currentUser);
            let ix = await PlaceProgram.claimTokens({
                claimer: this.currentUser,
                gameplay_token_random_seed: randomSeed,
                gameplay_token_ata: gptAta,
                dest_ata: destAtaPubkey,
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
        console.log("unsubscribing from patch updates");
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

        // @ts-ignore
        if (!onlyOneNull && newCurrentUser.toBase58() === this.currentUser.toBase58()) return;

        if (this.currentUser !== null) {
            console.log("Unsubscribing from previous user: ", this.currentUser)
            this.unsubscribeFromCurrentUserPlaceTokenAccounts();
            this.unsubscribeFromCurrentUserGptRecords();
        }

        this.currentUser = newCurrentUser;

        if (this.currentUser !== null) {
            console.log("Subscribing to state for new user: ", this.currentUser.toBase58());
            this.subscribeToCurrentUserPlaceTokenAccounts();
            this.subscribeToCurrentUserGptRecords();
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

    public getTotalClaimableTokensCount(): number | null {
        if (this.currentUser === null) return null;
        if (this.currentUserGptRecords === null) return null;

        return this.currentUserGptRecords.reduce((prev, value) => {
            return prev + value.gameplayTokenMetaAcct.data.place_tokens_owed
        }, 0);
    }

    public getCurrentUserGptRecordsSorted(): GameplayTokenRecord[] | null {
        if (this.currentUserGptRecords === null) return null;
        return this.currentUserGptRecords.sort((a, b) => {
            return a.gameplayTokenMetaAcct.data.update_allowed_slot
                .cmp(b.gameplayTokenMetaAcct.data.update_allowed_slot)
        })
    }

    private _handleGptAtaUpdated(mintPubkey: PublicKey, tokenAccount: TokenAccount) {
        if (this.currentUserGptRecords === null) {
            console.log("WARNING: tried to update record but currentUserGptRecords was null");
            return;
        }

        let updated = false;
        let awaitingRecord: AwaitingGptRecord | null = null;
        let awaitingRecordIdx = 0;
        let shouldUnsubscribe: PublicKeyB58[] = [];

        for (let [idx, record] of this.awaitingGptRecords.entries()) {
            if (record.gptMintPubkey.toBase58() === mintPubkey.toBase58()) {
                record.gptAtaAccount = tokenAccount
                awaitingRecord = record;
                awaitingRecordIdx = idx;
            }
        }

        if (awaitingRecord !== null) {
            // check if the awaiting record is ready to be upgraded
            if (awaitingRecord.gptMetaAccount !== null && awaitingRecord.gptAtaAccount) {
                this.currentUserGptRecords.push({
                    mintPubkey: awaitingRecord.gptMintPubkey.toBase58(),
                    gameplayTokenMetaAcct: awaitingRecord.gptMetaAccount,
                    userTokenAccount: awaitingRecord.gptAtaAccount,
                    _gptAccountSubscription: awaitingRecord.gptMetaSubscription,
                    _userTokenAccountSubscription: awaitingRecord.gptAtaSubscription,
                })

                this.awaitingGptRecords = this.awaitingGptRecords.splice(awaitingRecordIdx, 1);
                updated = true;
            }
        } else {
            for (let record of this.currentUserGptRecords) {
                if (record.mintPubkey === mintPubkey.toBase58()) {
                    record.userTokenAccount = tokenAccount;
                    updated = true;
                }

                if (!record.userTokenAccount.data.amount.eq(new BN(1))) {
                    console.log("user gpt token balance != 1")
                    shouldUnsubscribe.push(record.mintPubkey)
                }
            }

            console.log("GPT token acct changed: ", mintPubkey);
        }

        for (let unsub of shouldUnsubscribe) {
            this.unsubscribeFromGptRecord(unsub)
        }

        if (updated) {
            this.OnGameplayTokenRecordsUpdated.dispatch(this.currentUserGptRecords);
        }
    }

    private _handleGptMetaUpdated(mintPubkey: PublicKey, gptMetaAccount: GameplayTokenMetaAccount) {
        if (this.currentUserGptRecords === null) {
            console.log("WARNING: tried to update record but currentUserGptRecords was null");
            return;
        }

        let updated = false;
        let awaitingRecord: AwaitingGptRecord | null = null;
        let awaitingRecordIdx = 0;

        for (let [idx, record] of this.awaitingGptRecords.entries()) {
            if (record.gptMintPubkey.toBase58() === mintPubkey.toBase58()) {
                record.gptMetaAccount = gptMetaAccount
                awaitingRecord = record;
                awaitingRecordIdx = idx;
            }
        }

        if (awaitingRecord !== null) {
            // check if the awaiting record is ready to be upgraded
            if (awaitingRecord.gptMetaAccount !== null && awaitingRecord.gptAtaAccount) {
                this.currentUserGptRecords.push({
                    mintPubkey: awaitingRecord.gptMintPubkey.toBase58(),
                    gameplayTokenMetaAcct: awaitingRecord.gptMetaAccount,
                    userTokenAccount: awaitingRecord.gptAtaAccount,
                    _gptAccountSubscription: awaitingRecord.gptMetaSubscription,
                    _userTokenAccountSubscription: awaitingRecord.gptAtaSubscription,
                })

                this.awaitingGptRecords = this.awaitingGptRecords.splice(awaitingRecordIdx, 1);
                updated = true;
            }
        } else {
            for (let record of this.currentUserGptRecords) {
                if (record.mintPubkey === mintPubkey.toBase58()) {
                    record.gameplayTokenMetaAcct = gptMetaAccount;
                    updated = true;
                }
            }
        }

        if (updated) {
            this.OnGameplayTokenRecordsUpdated.dispatch(this.currentUserGptRecords);
        }
    }

    public async awaitGptRecord(purchaseIx: TransactionInstruction) {
        console.log("Awaiting stuff");
        let info = PlaceProgram.parseInfoFromPurchaseGameplayTokenIx(purchaseIx)

        let gptMetaSub = this.connection.onAccountChange(info.gptMetaPubkey, (acct) => {
            let gpt = new GameplayTokenMetaAccount(info.gptMetaPubkey, acct);
            this._handleGptMetaUpdated(info.gptMintPubkey, gpt);
        }, "processed");

        let gptAtaSub = this.connection.onAccountChange(info.gptAtaPubkey, (acct) => {
            let token = new TokenAccount(info.gptAtaPubkey, acct);
            this._handleGptAtaUpdated(info.gptMintPubkey, token);
        }, "processed");

        this.awaitingGptRecords.push({
            gptAtaAccount: null,
            gptMetaAccount: null,
            gptAtaPubkey: info.gptAtaPubkey,
            gptMetaPubkey: info.gptMetaPubkey,
            gptMintPubkey: info.gptMintPubkey,
            gptAtaSubscription: gptAtaSub,
            gptMetaSubscription: gptMetaSub,
        });
    }

    private async subscribeToCurrentUserGptRecords() {
        if (this.currentUser === null) {
            console.log("WARNING: refreshing current user gpt accounts with null current user");
            return;
        }

        if (this.currentUserGptRecords !== null) {
            console.log("WARNING: tried to subscribe without unsubscribing")
        }

        console.log("Subscribing to user token updates", this.currentUser.toBase58())

        this.currentUserGptRecords = await this.fetchGptRecords(this.currentUser);
        console.log("got ", this.currentUserGptRecords.length, " gpt records for current user");

        for (let record of this.currentUserGptRecords) {
            let mintPubkey = record.mintPubkey;
            let gptAcctPubkey = record.gameplayTokenMetaAcct.pubkey;
            let tokenAcctPubkey = record.userTokenAccount.pubkey;
            let gptSub = this.connection.onAccountChange(gptAcctPubkey, (acct) => {
                let gptAcct = new GameplayTokenMetaAccount(gptAcctPubkey, acct);
                this._handleGptMetaUpdated(new PublicKey(record.mintPubkey), gptAcct)
            }, "processed")
            record._gptAccountSubscription = gptSub;

            let tokenAcctSub = this.connection.onAccountChange(tokenAcctPubkey, (acct) => {
                let tokenAcct = new TokenAccount(tokenAcctPubkey, acct);
                this._handleGptAtaUpdated(new PublicKey(record.mintPubkey), tokenAcct);
            }, "processed")
            record._userTokenAccountSubscription = tokenAcctSub
        }

        console.log("Dispatching records update")
        this.OnGameplayTokenRecordsUpdated.dispatch(this.currentUserGptRecords);
    }

    private unsubscribeFromCurrentUserGptRecords() {
        if (this.currentUserGptRecords === null) {
            console.log("WARNING: tried to unsubscribe without subscribing")
            return;
        }

        for (let record of this.currentUserGptRecords) {
            if (record._gptAccountSubscription !== null) {
                this.connection.removeAccountChangeListener(record._gptAccountSubscription);
            }

            if (record._userTokenAccountSubscription !== null) {
                this.connection.removeAccountChangeListener(record._userTokenAccountSubscription);
            }
        }

        this.currentUserGptRecords = null;
    }


    private unsubscribeFromGptRecord(mintPubkey: PublicKeyB58) {
        if (this.currentUserGptRecords === null) {
            console.log("WARNING: attempted to remove gpt record, but no records exist: ", mintPubkey);
            return;
        }

        this.currentUserGptRecords = this.currentUserGptRecords
            .filter((record) => {
                if (record.mintPubkey === mintPubkey) {
                    if (record._gptAccountSubscription !== null) {
                        this.connection.removeAccountChangeListener(record._gptAccountSubscription);
                    }
                    if (record._userTokenAccountSubscription !== null) {
                        this.connection.removeAccountChangeListener(record._userTokenAccountSubscription);
                    }
                    return false;
                } else {
                    return true;
                }
            })

        this.OnGameplayTokenRecordsUpdated.dispatch(this.currentUserGptRecords);
    }

    private async fetchGptRecords(owner: PublicKey): Promise<GameplayTokenRecord[]> {
        let allUserTokenAccounts = await TokenAccount.getTokenAccountsByOwner(this.connection, owner);
        console.log("user token accts: ", allUserTokenAccounts.length)
        let potentialGptNftTokens = allUserTokenAccounts
            .filter((acct) => acct.data.amount != new BN(1));

        let gptRecords: GameplayTokenRecord[] = []

        for (const nftAcct of potentialGptNftTokens) {
            let mintPubkey = nftAcct.data.mint.toBase58();
            let gameplayTokenAccounts = await PlaceProgram.getProgramAccounts(this.connection, {
                commitment: "processed",
                filters: [
                    {
                        memcmp: {
                            bytes: mintPubkey,
                            offset: 1 + 1 + 8 + 8,
                        }
                    }
                ]
            })

            if (gameplayTokenAccounts.length > 0) {
                let accountInfo = gameplayTokenAccounts[0];
                let account = new GameplayTokenMetaAccount(accountInfo.pubkey, accountInfo.info)
                gptRecords.push({
                    gameplayTokenMetaAcct: account,
                    mintPubkey: mintPubkey,
                    userTokenAccount: nftAcct,
                    _gptAccountSubscription: null,
                    _userTokenAccountSubscription: null,
                })
            }
        }

        return gptRecords;
    }
}