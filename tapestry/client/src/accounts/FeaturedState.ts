import { PublicKey, AccountInfo, Connection } from '@solana/web3.js';
import { Borsh, Account, AnyPublicKey } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import BN from 'bn.js';
import { TapestryProgram } from '../TapestryProgram';
import { extendBorsh } from "../utils";

type FeaturedRegionArgs = {
    time_ms: number,
    x: number,
    y: number,
    width: number,
    height: number,
    callout: string,
    sol_domain: string,
}

export class FeaturedRegionData extends Borsh.Data<FeaturedRegionArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...FeaturedRegionData.struct([
            ['time_ms', 'u64'],
            ['x', 'i16'],
            ['y', 'i16'],
            ['width', 'i16'],
            ['height', 'i16'],
            ['callout', 'string'],
            ['sol_domain', 'string'],
        ])
    ])
    time_ms: number;
    x: number;
    y: number;
    width: number;
    height: number;
    callout: string;
    sol_domain: string;

    constructor(args: FeaturedRegionArgs) {
        super(args);

        this.time_ms = args.time_ms;
        this.x = args.x;
        this.y = args.y;
        this.width = args.width;
        this.height = args.height;
        this.callout = args.callout;
        this.sol_domain = args.sol_domain;
    }
}

type FeaturedStateArgs = {
    featured: [FeaturedRegionData],
}

export class FeaturedStateData extends Borsh.Data<FeaturedStateArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...FeaturedRegionData.SCHEMA,
        ...FeaturedStateData.struct([
            ['featured', [FeaturedRegionData]],
        ])
    ])

    featured: [FeaturedRegionData];

    constructor(args: FeaturedStateArgs) {
        super(args);

        this.featured = args.featured;
    }
}

export class FeaturedStateAccount extends Account<FeaturedStateData> {
    constructor(pubkey: AnyPublicKey, info: AccountInfo<Buffer>) {
        super(pubkey, info);

        if (!this.assertOwner(TapestryProgram.PUBKEY)) {
            throw Error("Invalid owner for featured state account")
        }

        this.data = FeaturedStateData.deserialize(this.info.data);
    }

    static async fetchFeaturedState(connection: Connection) {
        extendBorsh();
        let pda = await TapestryProgram.findFeaturedStateAddress();
        return await FeaturedStateAccount.load(connection, pda).catch((e) => {
            console.log("Error Deserializing Featured State Acct: \n", e);
            return null;
        });
    }
}