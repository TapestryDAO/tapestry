import { Borsh } from "@metaplex-foundation/mpl-core";
import { PublicKey } from "@solana/web3.js";
import { Schema } from "borsh";
import { PlaceInstruction } from "./types";
import BN from "bn.js";

export type UpdatePlaceStateArgs = {
    new_owner: PublicKey | null;
    is_frozen: boolean | null;
    paintbrush_price: BN | null;
    paintbrush_cooldown: BN | null;
    bomb_price: BN | null;
};

export class UpdatePlaceStateArgsData extends Borsh.Data<UpdatePlaceStateArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...UpdatePlaceStateArgsData.struct([
            ["instruction", "u8"],
            ["new_owner", { kind: "option", type: "pubkey" }],
            ["is_frozen", { kind: "option", type: "boolean" }],
            ["paintbrush_price", { kind: "option", type: "u64" }],
            ["paintbrush_cooldown", { kind: "option", type: "u64" }],
            ["bomb_price", { kind: "option", type: "u64" }],
        ]),
    ]);

    instruction: number = PlaceInstruction.UpdatePlaceState;
    new_owner: PublicKey | null;
    is_frozen: boolean | null;
    paintbrush_price: BN | null;
    paintbrush_cooldown: BN | null;
    bomb_price: BN | null;

    constructor(args: UpdatePlaceStateArgs) {
        super(args);
        this.new_owner = args.new_owner;
        this.is_frozen = args.is_frozen;
        this.paintbrush_price = args.paintbrush_price;
        this.paintbrush_cooldown = args.paintbrush_cooldown;
        this.bomb_price = args.bomb_price;
    }
}
