import {
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionInstruction,
} from "@solana/web3.js";
import { Program, TokenAccount } from "@metaplex-foundation/mpl-core";
import { SetPixelArgsData } from "./instructions/setPixel";
import { InitPatchArgsData } from "./instructions/initPatch";
import { UpdatePlaceStateArgsData } from "./instructions/updatePlaceState";
import { GameplayTokenType } from "./accounts";

import BN from "bn.js";
import { randomBytes } from "crypto";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Metadata, MetadataProgram } from "@metaplex-foundation/mpl-token-metadata";
import { PurchaseGameplayTokenArgsData } from "./instructions/purchaseGameplayToken";
import { InitMintArgsData } from "./instructions/initMint";
import { ClaimTokensArgsData } from "./instructions/claimTokens";
import { PlaceProgramVersion } from "./Config";

export const PLACE_HEIGHT_PX = 1000;
export const PLACE_WIDTH_PX = 1000;
export const PATCH_SIZE_PX = 20;

export type InitTokenMintParams = {
    owner: PublicKey;
};

export type SetPixelParams = {
    x: number;
    y: number;
    pixel: number;
    payer: PublicKey;
    // gamplay account holding token metadata
    gameplay_token_meta_acct: PublicKey;
    // SPL Token account holding actual token
    gameplay_token_acct: PublicKey;
};

export type InitPatchParams = {
    xPatch: number;
    yPatch: number;
    payer: PublicKey;
};

export type UpdatePlaceStateParams = {
    current_owner: PublicKey;
    new_owner: PublicKey | null;
    is_frozen: boolean | null;
    paintbrush_price: BN | null;
    paintbrush_cooldown: BN | null;
    bomb_price: BN | null;
};

export type PurchaseGameplayTokenParams = {
    payer: PublicKey;
    token_type: GameplayTokenType;
    desired_price: BN;
};

export type ClaimTokensParams = {
    claimer: PublicKey;
    gameplay_token_random_seed: BN;
    gameplay_token_ata: PublicKey;
    dest_ata: PublicKey;
};

export type PurchaseGameplayTokenInstructionInfo = {
    gptMintPubkey: PublicKey;
    gptAtaPubkey: PublicKey;
    gptMetaPubkey: PublicKey;
};

type PixelPatchCoords = {
    xPatch: number;
    yPatch: number;
    xOffset: number;
    yOffset: number;
};

export class PlaceProgram {

    static readonly PATCH_PDA_PREFIX = "patch";
    static readonly PLACE_STATE_PDA_PREFIX = "place";
    static readonly PLACE_TOKEN_MINT_PDA_PREFIX = "tokes";
    static readonly GAMEPLAY_TOKEN_META_PREFIX = "game";
    static readonly GAMEPLAY_TOKEN_MINT_PREFIX = "mint";

    public readonly programVersion: PlaceProgramVersion;
    public readonly programId: PublicKey;

    public constructor(version: PlaceProgramVersion) {
        this.programVersion = version;
        this.programId = new PublicKey(version.programId);
    }

    public async initPatch(params: InitPatchParams) {
        let data = InitPatchArgsData.serialize({
            xPatch: params.xPatch,
            yPatch: params.yPatch,
        });

        let patchPda = await this.findPatchPda(params.xPatch, params.yPatch);

        return new TransactionInstruction({
            keys: [
                { pubkey: params.payer, isSigner: true, isWritable: true },
                { pubkey: patchPda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: data,
        });
    }

    public async claimTokens(params: ClaimTokensParams) {
        let data = ClaimTokensArgsData.serialize({});
        let gameplay_token_meta_pda = await this.findGameplayMetaPda(
            params.gameplay_token_random_seed
        );
        let place_token_mint_pda = await this.findPlaceTokenMintPda();
        let place_state_pda = await this.findPlaceStatePda();
        return new TransactionInstruction({
            keys: [
                { pubkey: params.claimer, isSigner: true, isWritable: false },
                { pubkey: gameplay_token_meta_pda, isSigner: false, isWritable: true },
                { pubkey: params.gameplay_token_ata, isSigner: false, isWritable: false },
                { pubkey: place_token_mint_pda, isSigner: false, isWritable: true },
                { pubkey: params.dest_ata, isSigner: false, isWritable: true },
                { pubkey: place_state_pda, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: data,
        });
    }

    public async purchaseGameplayToken(params: PurchaseGameplayTokenParams) {
        let place_state_pda = await this.findPlaceStatePda();
        let randomSeed = new BN(randomBytes(8));
        let gameplay_meta_pda = await this.findGameplayMetaPda(randomSeed);
        let gameplay_token_mint_pda = await this.findGameplayTokenMintPda(randomSeed);
        let gameplay_token_ata = await this.findGameplayTokenMintAta(
            gameplay_token_mint_pda,
            params.payer
        );
        let gameplay_token_mpl_pda = await Metadata.getPDA(gameplay_token_mint_pda);

        let data = PurchaseGameplayTokenArgsData.serialize({
            token_type: params.token_type,
            random_seed: randomSeed,
            desired_price: params.desired_price,
        });

        return new TransactionInstruction({
            keys: [
                { pubkey: params.payer, isSigner: true, isWritable: true },
                { pubkey: place_state_pda, isSigner: false, isWritable: false },
                { pubkey: gameplay_meta_pda, isSigner: false, isWritable: true },
                { pubkey: gameplay_token_mint_pda, isSigner: false, isWritable: true },
                { pubkey: gameplay_token_ata, isSigner: false, isWritable: true },
                { pubkey: gameplay_token_mpl_pda, isSigner: false, isWritable: true },
                { pubkey: MetadataProgram.PUBKEY, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: data,
        })
    }

    // Keeping this here so its easier to remember to update with the instruction creation code
    public parseInfoFromPurchaseGameplayTokenIx(ix: TransactionInstruction): PurchaseGameplayTokenInstructionInfo {
        return {
            gptMetaPubkey: ix.keys[2].pubkey,
            gptMintPubkey: ix.keys[3].pubkey,
            gptAtaPubkey: ix.keys[4].pubkey,
        };
    }

    public async updatePlaceState(params: UpdatePlaceStateParams) {
        let place_state_pda = await this.findPlaceStatePda();
        let data = UpdatePlaceStateArgsData.serialize({
            new_owner: params.new_owner,
            is_frozen: params.is_frozen,
            paintbrush_price: params.paintbrush_price,
            paintbrush_cooldown: params.paintbrush_cooldown,
            bomb_price: params.bomb_price,
        });

        return new TransactionInstruction({
            keys: [
                { pubkey: params.current_owner, isSigner: true, isWritable: true },
                { pubkey: place_state_pda, isSigner: false, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: data,
        });
    }

    public async initTokenMint(params: InitTokenMintParams) {
        let place_state_pda = await this.findPlaceStatePda();
        let place_token_mint_pda = await this.findPlaceTokenMintPda();
        let place_token_mpl_meta_pda = await Metadata.getPDA(place_token_mint_pda);

        let data = InitMintArgsData.serialize({});

        return new TransactionInstruction({
            keys: [
                { pubkey: params.owner, isSigner: true, isWritable: true },
                { pubkey: place_state_pda, isSigner: false, isWritable: false },
                { pubkey: place_token_mint_pda, isSigner: false, isWritable: true },
                { pubkey: place_token_mpl_meta_pda, isSigner: false, isWritable: true },
                { pubkey: MetadataProgram.PUBKEY, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: data
        })
    }

    public async setPixel(params: SetPixelParams) {
        let patchCoords = this.computePatchCoords(params.x, params.y);

        console.log("Setting Patch Coords: ", patchCoords, "to color: ", params.pixel);
        let data = SetPixelArgsData.serialize({
            x: patchCoords.xPatch,
            y: patchCoords.yPatch,
            x_offset: patchCoords.xOffset,
            y_offset: patchCoords.yOffset,
            pixel: params.pixel,
        });

        let patchPda = await this.findPatchPda(patchCoords.xPatch, patchCoords.yPatch);

        return new TransactionInstruction({
            keys: [
                // TODO(will): this doesn't need to be writable after removing lazy alloc
                { pubkey: params.payer, isSigner: true, isWritable: true },
                { pubkey: patchPda, isSigner: false, isWritable: true },
                { pubkey: params.gameplay_token_meta_acct, isSigner: false, isWritable: true },
                { pubkey: params.gameplay_token_acct, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: data,
        });
    }

    public async findPatchPda(xPatch: number, yPatch: number): Promise<PublicKey> {
        let xBuf = Buffer.alloc(1);
        xBuf.writeUInt8(xPatch);
        let yBuf = Buffer.alloc(1);
        yBuf.writeUInt8(yPatch);

        let seeds = Buffer.concat([
            Buffer.from(PlaceProgram.PATCH_PDA_PREFIX),
            xBuf,
            yBuf,
        ])

        let result = await PublicKey.findProgramAddress([seeds], this.programId);
        return result[0];
    }

    public async findPlaceStatePda(): Promise<PublicKey> {
        let seeds = Buffer.concat([
            Buffer.from(PlaceProgram.PLACE_STATE_PDA_PREFIX),
        ])

        let result = await PublicKey.findProgramAddress([seeds], this.programId);
        return result[0];
    }

    public async findPlaceTokenMintPda(): Promise<PublicKey> {
        let seeds = Buffer.concat([
            Buffer.from(PlaceProgram.PLACE_STATE_PDA_PREFIX),
            Buffer.from(PlaceProgram.PLACE_TOKEN_MINT_PDA_PREFIX),
        ])

        let result = await PublicKey.findProgramAddress([seeds], this.programId);
        return result[0];
    }

    public async findGameplayMetaPda(randomSeed: BN): Promise<PublicKey> {
        let seeds = Buffer.concat([
            Buffer.from(PlaceProgram.GAMEPLAY_TOKEN_META_PREFIX),
            // NOTE(will): can't use .toBuffer("le") here
            // https://github.com/indutny/bn.js/issues/227
            randomSeed.toArrayLike(Buffer, "le", 8),
        ]);
        let result = await PublicKey.findProgramAddress([seeds], this.programId);
        return result[0];
    }

    public async findGameplayTokenMintPda(randomSeed: BN): Promise<PublicKey> {
        let seeds = Buffer.concat([
            Buffer.from(PlaceProgram.GAMEPLAY_TOKEN_META_PREFIX),
            // NOTE(will): can't use .toBuffer("le") here
            // https://github.com/indutny/bn.js/issues/227
            randomSeed.toArrayLike(Buffer, "le", 8),
            Buffer.from(PlaceProgram.GAMEPLAY_TOKEN_MINT_PREFIX),
        ]);
        let result = await PublicKey.findProgramAddress([seeds], this.programId);
        return result[0];
    }

    public async findGameplayTokenMintAta(gameplayTokenMintPda: PublicKey, userPubkey: PublicKey): Promise<PublicKey> {
        return await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            gameplayTokenMintPda,
            userPubkey,
            false
        ); // TODO(will): what are the implications of this?
    }

    private computePatchCoords(x: number, y: number): PixelPatchCoords {
        if (x > PLACE_WIDTH_PX || y > PLACE_HEIGHT_PX || x < 0 || y < 0) {
            throw Error("Invalid pixel coordinates: " + x + "," + y);
        }

        if (Math.floor(x) != x || Math.floor(y) != y) {
            throw Error("non-integer pixel coordinates passed: " + x + "," + y);
        }

        return {
            xPatch: Math.floor(x / PATCH_SIZE_PX),
            yPatch: Math.floor(y / PATCH_SIZE_PX),
            xOffset: x % PATCH_SIZE_PX,
            yOffset: y % PATCH_SIZE_PX,
        };
    }
}
