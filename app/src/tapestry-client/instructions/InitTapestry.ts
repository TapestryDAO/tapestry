import { Borsh } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { TapestryInstruction } from './types';

export type InitTapestryArgs = {
    initial_sale_price: number;
};

export class InitTapestryArgsData extends Borsh.Data<InitTapestryArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...InitTapestryArgsData.struct([
            ['instruction', 'u8'],
            ['initial_sale_price', 'u64'],
        ]),
    ]);

    instruction: number = TapestryInstruction.InitTapestry;
    initial_sale_price: number = 10_000_000;
};