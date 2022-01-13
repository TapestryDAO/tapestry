import { PublicKey, AccountInfo, Connection } from '@solana/web3.js';
import { Borsh, Account, AnyPublicKey, Program, TokenAccount } from '@metaplex-foundation/mpl-core';
import { Schema, BinaryReader, BinaryWriter } from 'borsh';
import BN from 'bn.js';
import { TapestryProgram } from '../TapestryProgram';
import { TokenAccountsCache } from '../TokenAccountsCache';

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


// NOTE(will): Fuggin borsh js doesn't support signed number types, so have to extend it this way

type BinaryReaderExtended = BinaryReader & {
    readI16(): number;
    readVecU8(): Buffer;
}

type BinaryWriterExtended = BinaryWriter & {
    writeI16(value: number): void;
    writeVecU8(value: Buffer): void;
}

let once = false;

export const extendBorsh = () => {

    // TODO (will): how can I make this get called once at the module level?
    if (once) return;
    once = true;

    (BinaryReader.prototype as BinaryReaderExtended).readI16 = function (
        this: BinaryReaderExtended,
    ) {
        let buf = Buffer.from(this.readFixedArray(2));
        return buf.readInt16LE(0);
    };

    (BinaryWriter.prototype as BinaryWriterExtended).writeI16 = function (
        this: BinaryWriterExtended,
        value: number,
    ) {
        let buf = Buffer.alloc(2);
        buf.writeInt16LE(value, 0);
        this.writeFixedArray(buf);
    };

    (BinaryReader.prototype as BinaryReaderExtended).readVecU8 = function (
        this: BinaryReaderExtended,
    ) {
        let len = this.readU32();
        let buf = Buffer.alloc(len);
        for (let i = 0; i < len; i++) {
            buf.writeUInt8(this.readU8(), i);
            // buf.writeUIntLE(this.readU8(), i, 1);
        }
        return buf;
    };

    (BinaryWriter.prototype as BinaryWriterExtended).writeVecU8 = function (
        this: BinaryWriterExtended,
        value: Buffer,
    ) {
        this.writeU32(value.length);
        value.forEach((byte) => this.writeU8(byte))
    };
}

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