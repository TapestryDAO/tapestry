import { Borsh } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { extendBorsh } from '../utils/borsh';


export type PatchArgs = {
    x: number,
    y: number,
    pixels: Buffer,
}

export class PatchData extends Borsh.Data<PatchArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...PatchData.struct([
            ['x', 'u8'],
            ['y', 'u8'],
            ['pixels', 'vecU8'],
        ])
    ])

    x: number;
    y: number;
    pixels: Buffer;

    constructor(args: PatchArgs) {
        super(args);
        this.x = args.x;
        this.y = args.y;
        this.pixels = args.pixels;
    }
}