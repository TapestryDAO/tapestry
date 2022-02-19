import { Borsh } from "@metaplex-foundation/mpl-core";
import { Schema } from "borsh";
import { PlaceInstruction } from "./types";

export type ClaimTokensArgs = {};

export class ClaimTokensArgsData extends Borsh.Data<ClaimTokensArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...ClaimTokensArgsData.struct([["instruction", "u8"]]),
    ]);

    instruction: number = PlaceInstruction.ClaimTokens;

    constructor(args: ClaimTokensArgs) {
        super(args);
    }
}
