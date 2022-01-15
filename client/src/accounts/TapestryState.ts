import { PublicKey, AccountInfo, Connection } from '@solana/web3.js';
import { Borsh, Account, AnyPublicKey } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import BN from 'bn.js';
import { TapestryProgram } from '../TapestryProgram';
import { TapestryPatchAccount } from './TapestryPatch';

type TapestryStateArgs = {
    is_initialized: boolean;
    owner: PublicKey;
    initial_sale_price: BN;
}

export class TapestryStateData extends Borsh.Data<TapestryStateArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...TapestryStateData.struct([
            ['is_initialized', 'u8'],
            ['owner', 'pubkey'],
            ['initial_sale_price', 'u64']
        ])
    ])

    is_initialized: boolean;
    owner: PublicKey;
    initial_sale_price: BN;

    constructor(args: TapestryStateArgs) {
        super(args);

        // why can metaplex's code omit this and it still compiles?
        this.is_initialized = args.is_initialized;
        this.owner = args.owner;
        this.initial_sale_price = args.initial_sale_price;
    }
};

export class TapestryStateAccount extends Account<TapestryStateData> {
    constructor(pubkey: AnyPublicKey, info: AccountInfo<Buffer>) {
        super(pubkey, info);

        if (!this.assertOwner(TapestryProgram.PUBKEY)) {
            // throw ERROR_INVALID_OWNER();
        }

        this.data = TapestryStateData.deserialize(this.info.data);
    }

    static async fetchState(connection: Connection) {
        let pda = await TapestryProgram.findTapestryStateAddress();
        return await TapestryStateAccount.load(connection, pda).catch(() => null);
    }
}