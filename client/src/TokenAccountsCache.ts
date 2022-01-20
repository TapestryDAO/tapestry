import { PublicKey, Connection } from "@solana/web3.js";
import { TokenAccount } from '@metaplex-foundation/mpl-core'
import BN from 'bn.js';

// NOTE(will): using Map with a PublicKey key silently used object references rather than
// value comparison, might be nice to extend PublicKey to implement whatever it needs for Maps

export type OwnerCacheEntry = {
    owner: PublicKey;
    timestamp: number; // ms since epoch
    token_accts_map: Map<string, TokenAccount>;
};


/// This cache is a helper used to determine if a user owns a given patch.
/// We fetch all the token accounts belonging to a given address that have a balance of 1
/// We then build a map from the mint address for those tokens, to the token accounts themselves
/// The patches include the mint address that created them, so by checking the map for the existence
/// of a token account created by the same mint linked to the patch, we can determine if the user owns
/// the patch.
export class TokenAccountsCache {

    static singleton = new TokenAccountsCache();

    private cache = new Map<string, OwnerCacheEntry>();

    static readonly CACHE_EPIRY_MS = 1_000 * 60 * 3;

    private in_flight = new Map<string, Promise<void>>()

    public isPatchOwned(patch: PublicKey, owner: PublicKey): boolean | undefined {
        const cacheEntry = this.cache.get(owner.toBase58())
        if (cacheEntry === undefined) {
            return undefined
        } else {
            return cacheEntry.token_accts_map.get(patch.toBase58()) !== undefined
        }
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

