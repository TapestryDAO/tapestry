import { Borsh } from "@metaplex-foundation/mpl-core";
import { Schema } from "borsh";
import { PlaceInstruction } from "./types";

export type InitMintArgs = {};

export class InitMintArgsData extends Borsh.Data<InitMintArgs> {
    static readonly SCHEMA: Schema = new Map([...InitMintArgsData.struct([["instruction", "u8"]])]);

    instruction: number = PlaceInstruction.InitMint;

    constructor(args: InitMintArgs) {
        super(args);
    }
}
