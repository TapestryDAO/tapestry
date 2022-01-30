import { Borsh } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { PlaceInstruction } from './types';

export type PixelColorArgs = {
    r: number,
    g: number,
    b: number,
}

export class PixelColorData extends Borsh.Data<PixelColorArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...PixelColorData.struct([
            // NOTE(will): This is an array on the rust side, but should deserialze the same
            ['r', 'u8'],
            ['g', 'u8'],
            ['b', 'u8'],
        ])
    ])

    r: number;
    g: number;
    b: number;

    constructor(args: PixelColorArgs) {
        super(args);
        this.r = args.r;
        this.g = args.g;
        this.b = args.b;
    }
}

export type SetPixelArgs = {
    x: number,
    y: number,
    x_offset: number,
    y_offset: number,
    pixel: PixelColorArgs,
};

export class SetPixelArgsData extends Borsh.Data<SetPixelArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...PixelColorData.SCHEMA,
        ...SetPixelArgsData.struct([
            ['instruction', 'u8'],
            ['x', 'u8'],
            ['y', 'u8'],
            ['x_offset', 'u8'],
            ['y_offset', 'u8'],
            ['pixel', PixelColorData],
        ]),
    ]);

    instruction: number = PlaceInstruction.SetPixel;
    x: number;
    y: number;
    x_offset: number;
    y_offset: number;
    pixel: PixelColorArgs;

    constructor(args: SetPixelArgs) {
        super(args);
        this.x = args.x;
        this.y = args.y;
        this.x_offset = args.x_offset;
        this.y_offset = args.y_offset;
        this.pixel = args.pixel;
    }
};