import { Borsh } from "@metaplex-foundation/mpl-core";
import { PublicKey } from "@solana/web3.js";
import { Schema } from "borsh";
import { PlaceAccountType } from "./types";
import BN from "bn.js";

export type PlaceStateArgs = {
    owner: PublicKey;
    is_frozen: boolean;
    paintbrush_price: BN;
    paintbrush_cooldown: BN;
    bomb_price: BN;
};

export class PlaceStateData extends Borsh.Data<PlaceStateArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...PlaceStateData.struct([
            ["acct_type", "u8"],
            ["owner", "pubkey"],
            ["is_frozen", "boolean"],
            ["paintbrush_price", "u64"],
            ["paintbrush_cooldown", "u64"],
            ["bomb_price", "u64"],
        ]),
    ]);

    acct_type: PlaceAccountType = PlaceAccountType.PlaceState;
    owner: PublicKey;
    is_frozen: boolean;
    paintbrush_price: BN;
    paintbrush_cooldown: BN;
    bomb_price: BN;

    constructor(args: PlaceStateArgs) {
        super(args);
        this.owner = args.owner;
        this.is_frozen = args.is_frozen;
        this.paintbrush_price = args.paintbrush_price;
        this.paintbrush_cooldown = args.paintbrush_cooldown;
        this.bomb_price = args.bomb_price;
    }
}
