import { PublicKey, AccountInfo, Connection, MemcmpFilter, GetProgramAccountsFilter } from '@solana/web3.js';
import { Borsh, Account, AnyPublicKey } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { TapestryProgram } from '../TapestryProgram';
import { extendBorsh } from "../utils";
import base58 from 'bs58';

const MAX_X = 1023;
const MIN_X = -1024;
const MAX_Y = 1023;
const MIN_Y = -1024;
const CHUNK_SIZE = 8;

export const MAX_CHUNK_IDX = 127
export const MIN_CHUNK_IDX = -128

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

type Vec2d = {
    x: number,
    y: number,
}

/**
 * @param chunkCoord The chunk coordinate within the tapestry
 * @param chunkLocalPatchCoord The coordinate of the patch within the chunks local row major coordinate system
 * @returns the coordinate of the patch within the tapestry
 */
export const chunkLocalPatchCoordToTapestryPatchCoord = (
    chunkLocalPatchCoord: Vec2d,
    chunkCoord: Vec2d): Vec2d => {

    return {
        x: chunkCoord.x >= 0 ?
            (CHUNK_SIZE * chunkCoord.x) + chunkLocalPatchCoord.x :
            ((chunkCoord.x + 1) * CHUNK_SIZE) - (CHUNK_SIZE - chunkLocalPatchCoord.x),
        y: chunkCoord.y >= 0 ?
            (CHUNK_SIZE * chunkCoord.y) + ((CHUNK_SIZE - 1) - chunkLocalPatchCoord.y) :
            (CHUNK_SIZE * (chunkCoord.y + 1)) - (chunkLocalPatchCoord.y + 1)
    }
}

/**
 * @param chunkCoord The chunk coordinate within the tapestry
 * @param patchCoord The patch coordinate within the tapestry
 * @returns A coordinate of the patch within the chunk's local row major coordinate system
 */
export const patchCoordToChunkLocalPatchCoord = (patchCoord: Vec2d, chunkCoord: Vec2d): Vec2d => {
    const chunkOriginX = patchCoord.x >= 0 ?
        chunkCoord.x * CHUNK_SIZE :
        ((chunkCoord.x + 1) * CHUNK_SIZE) - 1

    const chunkOriginY = patchCoord.y >= 0 ?
        chunkCoord.y * CHUNK_SIZE :
        ((chunkCoord.y + 1) * CHUNK_SIZE) - 1

    const xIndexRowMajor = patchCoord.x >= 0 ?
        patchCoord.x - chunkOriginX :
        (CHUNK_SIZE - 1) - Math.abs(patchCoord.x - chunkOriginX);

    const yIndexRowMajor = patchCoord.y >= 0 ?
        (CHUNK_SIZE - 1) - Math.abs(patchCoord.y - chunkOriginY) :
        chunkOriginY - patchCoord.y;
    return { x: xIndexRowMajor, y: yIndexRowMajor }
}

/**
 * 
 * @param patchCoord a coordinate of a patch in tapestry coorindates
 * @returns a chunkc coordinate which contains that patch coordinate
 */
export const patchCoordToChunkCoord = (patchCoord: Vec2d): Vec2d => {
    return {
        x: patchCoord.x >= 0 ?
            Math.floor(patchCoord.x / CHUNK_SIZE) :
            Math.ceil((patchCoord.x + 1) / CHUNK_SIZE) - 1,
        y: patchCoord.y >= 0 ?
            Math.floor(patchCoord.y / CHUNK_SIZE) :
            Math.ceil((patchCoord.y + 1) / CHUNK_SIZE) - 1,
    }
}

export class TapestryChunk {

    /// Row major order, can be null
    public chunkAccounts: MaybeTapestryPatchAccount[][]
    public xChunk: number
    public yChunk: number

    // Used to check if this is live data fetched from server, or is synthetic null chunk
    public isNullChunk: boolean

    constructor(xChunk: number, yChunk: number, unorderedChunk: TapestryPatchAccount[], isNullChunk: boolean = false) {
        this.chunkAccounts = TapestryPatchAccount.organizeChunk(unorderedChunk)
        this.xChunk = xChunk
        this.yChunk = yChunk
        this.isNullChunk = isNullChunk
    }

    /**
     * @param xIndex the xIndex of a patch in this chunks row major chunkAccounts array
     * @param yIndex the yIndex of a patch in this chunks row major chunkAccounts array
     * @returns the x,y coordinates of the patch in "tapestry coordinates"
     */
    public getPatchCoordsForChunkIndex(xIndex: number, yIndex: number): Vec2d {
        return chunkLocalPatchCoordToTapestryPatchCoord(
            { x: xIndex, y: yIndex },
            { x: this.xChunk, y: this.yChunk }
        )
    }

    public updatePatch(patch: TapestryPatchAccount) {
        let chunkLocalPatchCoords = patchCoordToChunkLocalPatchCoord(
            { x: patch.data.x, y: patch.data.y },
            { y: this.xChunk, x: this.yChunk },
        )

        this.chunkAccounts[chunkLocalPatchCoords.y][chunkLocalPatchCoords.x] = patch;
    }

    public static getNullChunk(xChunk: number, yChunk: number): TapestryChunk {
        return new TapestryChunk(xChunk, yChunk, [], true)
    }
}

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

    image_bitmap?: ImageBitmap

    constructor(pubkey: AnyPublicKey, info: AccountInfo<Buffer>) {
        extendBorsh();
        super(pubkey, info);

        let x = new Date().valueOf()

        if (!this.assertOwner(TapestryProgram.PUBKEY)) {
            // throw ERROR_INVALID_OWNER();
        }

        this.data = TapestryPatchData.deserialize(this.info.data);
    }

    public async loadBitmap() {
        let imageData = this.data.image_data
        if (imageData !== undefined) {
            try {
                let buffer = new Uint8Array(imageData)
                let blob = new Blob([buffer], { type: "image/gif" })
                return createImageBitmap(blob).then((value) => {
                    this.image_bitmap = value
                    return this
                })
            } catch (error) {
                console.log("image decoding failed: ", error)
                return Promise.resolve(this)
            }
        } else {
            return Promise.resolve(this)
        }
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
    public static organizeChunk(chunkAccounts: TapestryPatchAccount[]): MaybeTapestryPatchAccount[][] {
        let chunkArray = new Array<MaybeTapestryPatchAccount>(CHUNK_SIZE)
            .fill(null)
            .map(() =>
                new Array(CHUNK_SIZE).fill(null)
            );

        for (let i = 0; i < chunkAccounts.length; i++) {
            let patch = chunkAccounts[i];
            let localChunkCoord = patchCoordToChunkLocalPatchCoord(
                { x: patch.data.x, y: patch.data.y },
                { x: patch.data.x_chunk, y: patch.data.y_chunk }
            )

            chunkArray[localChunkCoord.y][localChunkCoord.x] = patch
        }

        return chunkArray
    }

    static async fetch(connection: Connection, x: number, y: number) {
        extendBorsh();
        let patch_pda = await TapestryProgram.findPatchAddressForPatchCoords(x, y);

        let info = await connection.getAccountInfo(patch_pda);
        if (!info) return null;

        let account = new TapestryPatchAccount(patch_pda, info);
        return account;
    }
}