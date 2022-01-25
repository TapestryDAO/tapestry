import { Borsh } from '@metaplex-foundation/mpl-core';
import { Schema } from 'borsh';
import { TapestryInstruction } from './types';
import { FeaturedRegionData } from '../accounts/FeaturedState';

export type PushFeaturedArgs = {
    featured: FeaturedRegionData;
};

export class PushFeaturedArgsData extends Borsh.Data<PushFeaturedArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...FeaturedRegionData.SCHEMA,
        ...PushFeaturedArgsData.struct([
            ['instruction', 'u8'],
            ['featured', FeaturedRegionData]
        ])
    ])

    instruction = TapestryInstruction.PushFeatured;
    featured: FeaturedRegionData;

    constructor(args: PushFeaturedArgs) {
        super(args);
        this.featured = args.featured;
    }
}