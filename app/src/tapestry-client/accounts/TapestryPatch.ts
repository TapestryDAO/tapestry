import { PublicKey, AccountInfo, Connection } from '@solana/web3.js';
import { Borsh, Account, AnyPublicKey } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import BN from 'bn.js';
import { TapestryProgram } from '../TapestryProgram';
import { TokenAccountsCache } from '../TokenAccountsCache';
import { extendBorsh } from "../utils";

type TapestryPatchArgs = {
    is_initialized: boolean;
    owned_by_mint: PublicKey;
    x_region: BN;
    y_region: BN;
    x: number;
    y: number;
    url?: string;
    hover_text?: string;
    image_data?: Buffer;
};

export class TapestryPatchData extends Borsh.Data<TapestryPatchArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...TapestryPatchData.struct([
            ['is_initialized', 'u8'],
            ['owned_by_mint', 'pubkey'],
            ["x_region", "u64"],
            ["y_region", "u64"],
            ["x", 'i16'],
            ["y", 'i16'],
            ["url", { kind: "option", type: "string" }],
            ["hover_text", { kind: "option", type: "string" }],
            ["image_data", { kind: 'option', type: "vecU8" }],
        ])
    ]);

    is_initialized: boolean;
    owned_by_mint: PublicKey;
    x_region: BN;
    y_region: BN;
    x: number;
    y: number;
    url?: string;

    hover_text?: string;
    image_data?: Buffer;

    constructor(args: TapestryPatchArgs) {
        super(args)

        // TODO(will): figure out how metaplex is able to not write all this out
        this.is_initialized = args.is_initialized;
        this.owned_by_mint = args.owned_by_mint;
        this.x_region = args.x_region;
        this.y_region = args.y_region;
        this.x = args.x;
        this.y = args.y;
        this.url = args.url;
        this.hover_text = args.hover_text;
        this.image_data = args.image_data;
    }
};

export class TapestryPatchAccount extends Account<TapestryPatchData> {
    constructor(pubkey: AnyPublicKey, info: AccountInfo<Buffer>) {
        super(pubkey, info);

        let x = new Date().valueOf()

        if (!this.assertOwner(TapestryProgram.PUBKEY)) {
            // throw ERROR_INVALID_OWNER();
        }

        this.data = TapestryPatchData.deserialize(this.info.data);
    }

    static async fetch(connection: Connection, x: number, y: number) {
        extendBorsh();
        let patch_pda = await TapestryProgram.findPatchAddressForPatchCoords(x, y);
        // let account = await TapestryPatchAccount.load(connection, patch_pda).catch(() => null);
        // return account;

        let info = await connection.getAccountInfo(patch_pda);
        if (!info) return null;

        let account = new TapestryPatchAccount(patch_pda, info);
        return account;
    }

    async isOwnedBy(connection: Connection, owner: PublicKey) {
        await TokenAccountsCache.singleton.refreshCache(connection, owner);
        let cacheForOwner = TokenAccountsCache.singleton.cache.get(owner.toBase58());
        let myMap = cacheForOwner?.token_accts_map;
        let tokenAcct = myMap?.get(this.data.owned_by_mint.toBase58());
        return !!tokenAcct
    }
}