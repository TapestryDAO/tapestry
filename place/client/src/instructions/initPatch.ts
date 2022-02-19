import { Borsh } from "@metaplex-foundation/mpl-core";
import { Schema } from "borsh";
import { PlaceInstruction } from "./types";

export type InitPatchArgs = {
    xPatch: number;
    yPatch: number;
};

export class InitPatchArgsData extends Borsh.Data<InitPatchArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...InitPatchArgsData.struct([
            ["instruction", "u8"],
            ["xPatch", "u8"],
            ["yPatch", "u8"],
        ]),
    ]);

    instruction: number = PlaceInstruction.InitPatch;
    xPatch: number;
    yPatch: number;

    constructor(args: InitPatchArgs) {
        super(args);
        this.xPatch = args.xPatch;
        this.yPatch = args.yPatch;
    }
}
