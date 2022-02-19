import { Borsh } from "@metaplex-foundation/mpl-core";
import { Schema } from "borsh";
import { GameplayTokenType } from "../accounts";
import { PlaceInstruction } from "./types";
import BN from "bn.js";

export type PurchaseGameplayTokenArgs = {
    token_type: GameplayTokenType;
    random_seed: BN;
    desired_price: BN;
};

export class PurchaseGameplayTokenArgsData extends Borsh.Data<PurchaseGameplayTokenArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...PurchaseGameplayTokenArgsData.struct([
            ["instruction", "u8"],
            ["token_type", "u8"],
            ["random_seed", "u64"],
            ["desired_price", "u64"],
        ]),
    ]);

    instruction: number = PlaceInstruction.PurchaseGameplayToken;
    token_type: GameplayTokenType;
    random_seed: BN;
    desired_price: BN;

    constructor(args: PurchaseGameplayTokenArgs) {
        super(args);
        this.token_type = args.token_type;
        this.random_seed = args.random_seed;
        this.desired_price = args.desired_price;
    }
}
