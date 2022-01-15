import { Borsh } from '@metaplex-foundation/mpl-core'
import { Schema } from 'borsh'
import { TapestryInstruction } from './types'

export type UpdatePatchMetadataArgs = {
    x: number,
    y: number,
    url?: string,
    hover_text?: string,
}

export class UpdatePatchMetadataArgsData extends Borsh.Data<UpdatePatchMetadataArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...UpdatePatchMetadataArgsData.struct([
            ['instruction', 'u8'],
            ['x', 'i16'],
            ['y', 'i16'],
            ['url', { kind: 'option', type: 'string' }],
            ['hover_text', { kind: 'option', type: 'string' }],
        ]),
    ]);

    instruction = TapestryInstruction.UpdatePatchMetadata;
    x: number;
    y: number;
    url?: string;
    hover_text?: string;

    constructor(args: UpdatePatchMetadataArgs) {
        super(args);
        this.x = args.x;
        this.y = args.y;
        this.url = args.url;
        this.hover_text = args.hover_text;
    }
}