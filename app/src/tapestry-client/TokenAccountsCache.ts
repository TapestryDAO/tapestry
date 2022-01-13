import { PublicKey, Connection } from "@solana/web3.js";
import { TokenAccount } from '@metaplex-foundation/mpl-core'
import BN from 'bn.js';
import React, { FC } from 'react';


// NOTE(will): using Map with a PublicKey key silently used object references rather than
// value comparison, might be nice to extend PublicKey to implement whatever it needs for Maps

export type OwnerCacheEntry = {
    owner: PublicKey;
    timestamp: number; // ms since epoch
    token_accts_map: Map<string, TokenAccount>;
};

export class TokenAccountsCache {

    static singleton = new TokenAccountsCache();

    cache = new Map<string, OwnerCacheEntry>();

    static readonly CACHE_EPIRY_MS = 1_000 * 60 * 3;

    async refreshCache(connection: Connection, owner: PublicKey, force: boolean = false) {
        // is reading time this way slow? this might get called alot
        let currentTimeMillis = new Date().valueOf();
        let existingEntry = this.cache.get(owner.toBase58())
        if (!force
            && !!existingEntry
            && existingEntry.timestamp - currentTimeMillis < TokenAccountsCache.CACHE_EPIRY_MS) {
            return false;
        }

        const accounts = await TokenAccount.getTokenAccountsByOwner(connection, owner);
        const filteredAccounts = accounts
            .filter((acct) => acct.data.amount != new BN(1))
            .map((acct) => [acct.data.mint.toBase58(), acct] as [string, TokenAccount]);

        this.cache.set(owner.toBase58(), {
            owner: owner,
            timestamp: new Date().valueOf(),
            token_accts_map: new Map<string, TokenAccount>(filteredAccounts),
        })

        return true;
    }
}

