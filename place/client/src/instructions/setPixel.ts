import { Borsh } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { PlaceInstruction } from './types';

export type SetPixelArgs = {
    x: number,
    y: number,
    x_offset: number,
    y_offset: number,
    pixel: number,
};

export class SetPixelArgsData extends Borsh.Data<SetPixelArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...SetPixelArgsData.struct([
            ['instruction', 'u8'],
            ['x', 'u8'],
            ['y', 'u8'],
            ['x_offset', 'u8'],
            ['y_offset', 'u8'],
            ['pixel', 'u8'],
        ]),
    ]);

    instruction: number = PlaceInstruction.SetPixel;
    x: number;
    y: number;
    x_offset: number;
    y_offset: number;
    pixel: number;

    constructor(args: SetPixelArgs) {
        super(args);
        this.x = args.x;
        this.y = args.y;
        this.x_offset = args.x_offset;
        this.y_offset = args.y_offset;
        this.pixel = args.pixel;
    }
};