import { Borsh } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { TapestryInstruction } from './types';

export type UpdatePatchImageArgs = {
    x: number,
    y: number,
    image_data: Buffer,
}

export class UpdatePatchImageArgsData extends Borsh.Data<UpdatePatchImageArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...UpdatePatchImageArgsData.struct([
            ['instruction', 'u8'],
            ['x', 'i16'],
            ['y', 'i16'],
            ['image_data', "vecU8"],
        ]),
    ]);

    instruction = TapestryInstruction.UpdatePatchImage;
    x: number;
    y: number;
    image_data: Buffer;

    constructor(args: UpdatePatchImageArgs) {
        super(args);
        this.x = args.x;
        this.y = args.y;
        this.image_data = args.image_data;
    }
}