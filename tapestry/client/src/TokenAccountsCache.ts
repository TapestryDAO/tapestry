import { PublicKey, Connection, AccountInfo } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID, MintLayout, MintInfo } from "@solana/spl-token";
import { TokenAccount } from '@metaplex-foundation/mpl-core'
import { TapestryClient, TapestryPatchAccount, TapestryChunk, TapestryRegion } from ".";
import BN from 'bn.js';
import { Buffer } from 'buffer';
import assert from 'assert';
import { Signal } from 'type-signals';

// NOTE(will): using Map with a PublicKey key silently used object references rather than
// value comparison, might be nice to extend PublicKey to implement whatever it needs for Maps

export type OwnerCacheEntry = {
    owner: PublicKey;
    timestamp: number; // ms since epoch
    token_accts_map: Map<string, TokenAccount>;
};

export type UserChunksUpdatedHandler = (user: PublicKey, chunks: TapestryChunk[]) => void;

/// This cache is a helper used to determine if a user owns a given patch.
/// We fetch all the token accounts belonging to a given address that have a balance of 1
/// We then build a map from the mint address for those tokens, to the token accounts themselves
/// The patches include the mint address that created them, so by checking the map for the existence
/// of a token account created by the same mint linked to the patch, we can determine if the user owns
/// the patch.
export class TokenAccountsCache {

    static singleton = new TokenAccountsCache();

    private cache = new Map<string, OwnerCacheEntry>();

    /// Mapping from owner pubkey to patches
    // private userOwnedPatches = new Map<string, TapestryPatchAccount[]>();

    /// Mapping from owner pubkey to regions
    public userOwnedChunks = new Map<string, TapestryChunk[]>();

    static readonly CACHE_EPIRY_MS = 1_000 * 60 * 3;

    private in_flight = new Map<string, Promise<void>>()

    public OnUserChunksUpdated = new Signal<UserChunksUpdatedHandler>();

    public isPatchOwned(patch: PublicKey, owner: PublicKey): boolean | undefined {
        const cacheEntry = this.cache.get(owner.toBase58())
        if (cacheEntry === undefined) {
            return undefined
        } else {
            return cacheEntry.token_accts_map.get(patch.toBase58()) !== undefined
        }
    }

    async getMintInfo(connection: Connection, mint_pubkey: PublicKey): Promise<MintInfo> {
        const info = await connection.getAccountInfo(mint_pubkey);

        if (info === null) {
            throw new Error('Failed to find mint account');
        }

        if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
            throw new Error(`Invalid mint owner: ${JSON.stringify(info.owner)}`);
        }

        if (info.data.length != MintLayout.span) {
            throw new Error(`Invalid mint size`);
        }

        const data = Buffer.from(info.data);
        const mintInfo = MintLayout.decode(data);

        if (mintInfo.mintAuthorityOption === 0) {
            mintInfo.mintAuthority = null;
        } else {
            mintInfo.mintAuthority = new PublicKey(mintInfo.mintAuthority);
        }

        // NOTE(will): Omitting this because I don't need the supply and it doesn't work
        // without this snippet I can't get to compile here:
        // https://github.com/solana-labs/solana-program-library/blob/0a61bc4ea30f818d4c86f4fe1863100ed261c64d/token/js/client/token.js#L50
        // mintInfo.supply = u64.fromBuffer(mintInfo.supply);

        mintInfo.supply = 0;
        mintInfo.isInitialized = mintInfo.isInitialized != 0;

        if (mintInfo.freezeAuthorityOption === 0) {
            mintInfo.freezeAuthority = null;
        } else {
            mintInfo.freezeAuthority = new PublicKey(mintInfo.freezeAuthority);
        }

        return mintInfo;
    }


    public async fetchPatchesForTokenAccounts(connection: Connection, userPubkey: PublicKey, tokenAccounts: TokenAccount[]) {
        console.log("Fetching patches for token accounts");
        let mintInfos: MintInfo[] = [];

        for (let acct of tokenAccounts) {
            let mintInfo = await this.getMintInfo(connection, acct.data.mint)
            mintInfos.push(mintInfo)
        }

        let patches: TapestryPatchAccount[] = [];
        for (let mintInfo of mintInfos) {
            if (mintInfo.freezeAuthority != null) {
                let patch = await TapestryPatchAccount.fetchWithPubkey(connection, mintInfo.freezeAuthority);
                if (patch != null) {
                    patches.push(patch);
                }
            }
        }

        // take the user's owned patches
        // and divide them into their repsective chunks and we can render chunks in the UI
        // This way the groupings will be stable, and the rendering can be predictable
        // I.e. we are always rendering an 8x8 chunk, if rendering performance sucks,
        // i'll subidivde into mini chunks
        let chunks = new Map<string, TapestryPatchAccount[]>();
        for (let patch of patches) {
            let key = "" + patch.data.x_chunk + "," + patch.data.y_chunk;
            let existing = chunks.get(key)
            if (existing === undefined) {
                chunks.set(key, [patch])
            } else {
                existing.push(patch)
            }
        }

        // delete the previously set user owned chunks
        this.userOwnedChunks.delete(userPubkey.toBase58());

        for (let chunkPair of chunks) {
            let patchesArr = chunkPair[1];
            if (patchesArr == null) continue;
            let anyPatch = patchesArr[0];
            if (anyPatch == null) continue;
            let chunk = new TapestryChunk(anyPatch.data.x_chunk, anyPatch.data.y_chunk, patchesArr);

            let userChunks = this.userOwnedChunks.get(userPubkey.toBase58())
            if (userChunks === undefined) {
                this.userOwnedChunks.set(userPubkey.toBase58(), [chunk]);
            } else {
                userChunks.push(chunk)
            }
        }

        let chunksFinal = this.userOwnedChunks.get(userPubkey.toBase58());

        if (chunksFinal !== undefined) {
            console.log("Refreshed user chunks: ", chunksFinal.length);
            this.OnUserChunksUpdated.dispatch(userPubkey, chunksFinal);
        } else {
            this.OnUserChunksUpdated.dispatch(userPubkey, []);
        }

        // TODO(will): Sort user chunks array somehow so that order is stable?
    }

    public refreshCache(connection: Connection, owner: PublicKey, force: boolean = false): Promise<void> {
        let ownerB58 = owner.toBase58()
        let currentTimeMillis = new Date().valueOf();
        let existingEntry = this.cache.get(ownerB58)
        if (!force
            && !!existingEntry
            && existingEntry.timestamp - currentTimeMillis < TokenAccountsCache.CACHE_EPIRY_MS) {
            return Promise.resolve()
        }

        let existing_request = this.in_flight.get(ownerB58)

        if (existing_request !== undefined) {
            // console.log("existing request in flight")
            return existing_request
        }

        let promise = TokenAccount.getTokenAccountsByOwner(connection, owner).then((accounts) => {

            this.fetchPatchesForTokenAccounts(connection, owner, accounts);

            const filteredAccounts = accounts
                .filter((acct) => acct.data.amount != new BN(1))
                .map((acct) => [acct.data.mint.toBase58(), acct] as [string, TokenAccount]);

            console.log("Fetched ", filteredAccounts.length, "Token accconts for ", ownerB58)

            this.cache.set(ownerB58, {
                owner: owner,
                timestamp: new Date().valueOf(),
                token_accts_map: new Map<string, TokenAccount>(filteredAccounts),
            })

            this.in_flight.delete(ownerB58)
        })

        this.in_flight.set(ownerB58, promise)

        return promise
    }
}

