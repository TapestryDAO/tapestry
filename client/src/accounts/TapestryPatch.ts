import { PublicKey, AccountInfo, Connection, MemcmpFilter, GetProgramAccountsFilter } from '@solana/web3.js';
import { Borsh, Account, AnyPublicKey } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { TapestryProgram } from '../TapestryProgram';
import { TokenAccountsCache } from '../TokenAccountsCache';
import { extendBorsh } from "../utils";
import base58 from 'bs58';

const MAX_X = 1023;
const MIN_X = -1024;
const MAX_Y = 1023;
const MIN_Y = -1024;
const CHUNK_SIZE = 8;

// This has to be kept in sync with state.rs
const MAX_PATCH_IMAGE_DATA_LEN = 1024;
const MAX_PATCH_URL_LEN = 128;
const MAX_PATCH_HOVER_TEXT_LEN = 64;

const MAX_PATCH_TOTAL_LEN = 0 +
    1 + // is_initialized
    32 + // owned_by_mint
    1 + // x_chunk
    1 + // y_chunk
    2 + // x
    2 + // y
    1 + 4 + MAX_PATCH_URL_LEN + // url
    1 + 4 + MAX_PATCH_HOVER_TEXT_LEN + // hover text
    1 + 4 + MAX_PATCH_IMAGE_DATA_LEN; // image data

const CHUNK_OFFSET = 1 + 32;

type TapestryPatchArgs = {
    is_initialized: boolean;
    owned_by_mint: PublicKey;
    x_chunk: number;
    y_chunk: number;
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
            ["x_chunk", "i8"],
            ["y_chunk", "i8"],
            ["x", 'i16'],
            ["y", 'i16'],
            ["url", { kind: "option", type: "string" }],
            ["hover_text", { kind: "option", type: "string" }],
            ["image_data", { kind: 'option', type: "vecU8" }],
        ])
    ]);

    is_initialized: boolean;
    owned_by_mint: PublicKey;
    x_chunk: number;
    y_chunk: number;
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
        this.x_chunk = args.x_chunk;
        this.y_chunk = args.y_chunk;
        this.x = args.x;
        this.y = args.y;
        this.url = args.url;
        this.hover_text = args.hover_text;
        this.image_data = args.image_data;
    }
};

export type ChunkOffset = { xOffset: number, yOffset: number }

export type MaybeTapestryPatchAccount = TapestryPatchAccount | null;

export class TapestryPatchAccount extends Account<TapestryPatchData> {

    constructor(pubkey: AnyPublicKey, info: AccountInfo<Buffer>) {
        extendBorsh();
        super(pubkey, info);

        let x = new Date().valueOf()

        if (!this.assertOwner(TapestryProgram.PUBKEY)) {
            // throw ERROR_INVALID_OWNER();
        }

        this.data = TapestryPatchData.deserialize(this.info.data);
    }

    static getChunkFilters(xChunk: number, yChunk: number): GetProgramAccountsFilter[] {
        let bytesBuf = Buffer.alloc(2)
        bytesBuf.writeIntLE(xChunk, 0, 1)
        bytesBuf.writeIntLE(yChunk, 1, 1);

        return [
            { dataSize: MAX_PATCH_TOTAL_LEN },
            { memcmp: { offset: CHUNK_OFFSET, bytes: base58.encode(bytesBuf) } }
        ]
    }


    /**
     * @param chunk an unordered array of patches belonging to a particular chunk
     * @returns An organized 8x8 2D array of patches in row major order
     */
    public static organizeChunk(chunk: TapestryPatchAccount[]): MaybeTapestryPatchAccount[][] {
        let chunkArray = Array<MaybeTapestryPatchAccount[]>()

        for (let i = 0; i < 8; i++) {
            chunkArray.push(Array(8).fill(null))
        }

        for (let i = 0; i < chunk.length; i++) {
            let patch = chunk[i];

            // Chunks can be thought of as a "corner", so the picture at the origin looks like this
            //                 
            //              |
            //       -1,0   |   0,0
            //       _______|________
            //              |  
            //      -1,-1   |   0,-1
            //              |

            let xChunkOffset = patch.data.x - (patch.data.x_chunk * CHUNK_SIZE)
            let yChunkOffset = patch.data.y - (patch.data.y_chunk * CHUNK_SIZE)

            // This was awkward, but if you just think in one direction at a time it makes sense

            let xIndex = patch.data.x_chunk >= 0 ? xChunkOffset : xChunkOffset + (CHUNK_SIZE - 1)
            let yIndex = patch.data.y_chunk >= 0 ? (CHUNK_SIZE - 1) - yChunkOffset : -yChunkOffset

            chunkArray[xIndex][yIndex] = patch
        }

        return chunkArray
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