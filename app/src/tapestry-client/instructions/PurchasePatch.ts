import { Borsh } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { TapestryInstruction } from './types';

export type PurchasePatchArgs = {
    x: number;
    y: number;
};

export class PurchasePatchArgsData extends Borsh.Data<PurchasePatchArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...PurchasePatchArgsData.struct([
            ['instruction', 'u8'],
            ['x', 'i16'],
            ['y', 'i16'],
        ]),
    ]);

    instruction = TapestryInstruction.PurchasePatch;
    x: number;
    y: number;

    constructor(args: PurchasePatchArgs) {
        super(args);
        this.x = args.x;
        this.y = args.y;
    }
}