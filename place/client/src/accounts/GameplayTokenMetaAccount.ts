import { GameplayTokenType, PlaceAccountType } from ".";
import BN from "bn.js";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import { Account, AnyPublicKey, Borsh } from "@metaplex-foundation/mpl-core";
import { Schema } from "borsh";
import { extendBorsh } from "../utils/borsh";

type GameplayTokenMetaArgs = {
    acct_type: PlaceAccountType;
    gameplay_type: GameplayTokenType;
    created_at_slot: BN;
    random_seed: BN;
    token_mint_pda: PublicKey;
    update_allowed_slot: BN;
    cooldown_duration: BN;
    place_tokens_owed: number;
};

export class GameplayTokenMetaData extends Borsh.Data<GameplayTokenMetaArgs> {
    static readonly SCHEMA: Schema = new Map([
        ...GameplayTokenMetaData.struct([
            ["acct_type", "u8"],
            ["gameplay_type", "u8"],
            ["created_at_slot", "u64"],
            ["random_seed", "u64"],
            ["token_mint_pda", "pubkey"],
            ["update_allowed_slot", "u64"],
            ["cooldown_duration", "u64"],
            ["place_tokens_owed", "u32"],
        ]),
    ]);

    acct_type: PlaceAccountType;
    gameplay_type: GameplayTokenType;
    created_at_slot: BN;
    random_seed: BN;
    token_mint_pda: PublicKey;
    update_allowed_slot: BN;
    cooldown_duration: BN;
    place_tokens_owed: number;

    constructor(args: GameplayTokenMetaArgs) {
        super(args);

        this.acct_type = args.acct_type;
        this.gameplay_type = args.gameplay_type;
        this.created_at_slot = args.created_at_slot;
        this.random_seed = args.random_seed;
        this.token_mint_pda = args.token_mint_pda;
        this.update_allowed_slot = args.update_allowed_slot;
        this.cooldown_duration = args.cooldown_duration;
        this.place_tokens_owed = args.place_tokens_owed;
    }
}

export class GameplayTokenMetaAccount extends Account<GameplayTokenMetaData> {
    constructor(pubkey: AnyPublicKey, info: AccountInfo<Buffer>) {
        extendBorsh();
        super(pubkey, info);
        this.data = GameplayTokenMetaData.deserialize(this.info.data);
    }
}
