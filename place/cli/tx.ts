import { sendAndConfirmTransaction, Transaction, ConfirmOptions, PublicKey } from '@solana/web3.js';
import { inspect } from 'util';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { applyKeynameOption, applyXYArgOptions, KeynameOptionArgs, XYOptionArgs } from '../../cli_utils/commandHelpers';
import { getNewConnection, loadKey, makeJSONRPC, SOLANA_MAINNET_ENDPOINT } from '../../cli_utils/utils';
import { PlaceProgram, SetPixelParams, PLACE_HEIGHT_PX, PLACE_WIDTH_PX, PATCH_SIZE_PX } from '../client/src/PlaceProgram';
import { PlaceClient } from '../client/src/PlaceClient';
import BN from 'bn.js';
import { GameplayTokenType } from '../client/src/accounts';
// @ts-ignore
import asyncPool from "tiny-async-pool"
import { GameplayTokenMetaAccount } from '../client/src/accounts/GameplayTokenMetaAccount';
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const MAX_COLORS = 256;

type Vec2d = { x: number, y: number }

type InitAllPatchesCommandArgs = KeynameOptionArgs

const init_all_patches_command = {
    command: "initpatches",
    description: "initialize all the patches",
    builder: (args: Argv): Argv<InitAllPatchesCommandArgs> => {
        return applyKeynameOption(args);
    },
    handler: async (args: ArgumentsCamelCase<InitAllPatchesCommandArgs>) => {

        let keypair = loadKey(args.keyname);
        let connection = getNewConnection();
        let connectionConfig: ConfirmOptions = {
            skipPreflight: true,
            commitment: 'confirmed',
        };

        const maxXPatch = PLACE_WIDTH_PX / PATCH_SIZE_PX;
        const maxYPatch = PLACE_HEIGHT_PX / PATCH_SIZE_PX;

        const getNext = (current: Vec2d): Vec2d | null => {
            let nextX = current.x + 1;
            if (nextX > maxXPatch) {
                let nextY = current.y + 1;
                if (nextY > maxYPatch) {
                    return null;
                } else {
                    return { x: 0, y: nextY };
                }
            } else {
                return { x: nextX, y: current.y };
            }
        }

        console.time('xy')
        const AllXY: Vec2d[][] = [[{ x: 0, y: 0 }]]
        let index = 0
        getNext(AllXY[index][AllXY.length - 1])
        let next = getNext(AllXY[index][AllXY.length - 1])
        while (next) {
            if (!AllXY[index]) AllXY[index] = []
            AllXY[index].push(next)
            if (AllXY[index].length > 6) index = index + 1
            next = getNext(next)
        }

        const results = await asyncPool(20, AllXY, (async (currentXYs: Vec2d[]) => {

            console.log("Init: ", currentXYs);
            let tx = new Transaction()
            await Promise.all(currentXYs.map(async currentXY => {
                tx.add(await PlaceProgram.initPatch({
                    xPatch: currentXY.x,
                    yPatch: currentXY.y,
                    payer: keypair.publicKey,
                }))
            }))

            await sendAndConfirmTransaction(connection, tx, [keypair], connectionConfig)

        }));
        console.timeEnd('xy')
        console.log("All done, hopefully nothing failed");
    }
}

type InitMintCommandArgs = KeynameOptionArgs

const init_mint_command = {
    command: "initmint",
    description: "Initialize the global token mint",
    builder: (args: Argv): Argv<InitMintCommandArgs> => {
        return applyKeynameOption(args);
    },
    handler: async (args: ArgumentsCamelCase<InitMintCommandArgs>) => {
        let owner_keypair = loadKey(args.keyname);
        let init_mint_ix = await PlaceProgram.initTokenMint({ owner: owner_keypair.publicKey })
        let tx = new Transaction().add(init_mint_ix);
        let connection = getNewConnection();
        let result = await sendAndConfirmTransaction(connection, tx, [owner_keypair]);
        console.log("Result: ", result);
    }
}

// type SetPixelCommandArgs =
//     XYOptionArgs &
//     KeynameOptionArgs &
//     { c: number }

// const set_pixel_command = {
//     command: "set_pixel",
//     description: "set a pixel to an rgb value",
//     builder: (args: Argv): Argv<SetPixelCommandArgs> => {
//         return applyXYArgOptions(applyKeynameOption(args))
//             .option("c", {
//                 description: "8 bit color value, 0-255",
//                 type: "number",
//                 required: true,
//             })
//     },
//     handler: async (args: ArgumentsCamelCase<SetPixelCommandArgs>) => {
//         let payer = loadKey(args.keyname);
//         let connection = getNewConnection();
//         let pixelValue = [0, 0, 0];

//         let params: SetPixelParams = {
//             x: args.x,
//             y: args.y,
//             pixel: args.c,
//             payer: payer.publicKey,
//         }

//         let ix = await PlaceProgram.setPixel(params);
//         let tx = new Transaction().add(ix);
//         let sig = await sendAndConfirmTransaction(connection, tx, [payer]);
//         let result = await connection.confirmTransaction(sig, "confirmed");

//         console.log("Sig: ", sig);
//         console.log("Err: ", result.value.err);
//     }
// }

// type RandomWalkerCommandArgs =
//     XYOptionArgs &
//     KeynameOptionArgs &
//     { colors: number }

// const random_walker_command = {
//     command: "walker",
//     description: "start an infinite random walker",
//     builder: (args: Argv): Argv<RandomWalkerCommandArgs> => {
//         return applyKeynameOption(applyXYArgOptions(args))
//             .option("colors", {
//                 description: "number of colors",
//                 type: "number",
//                 default: 256,
//             })
//     },
//     handler: async (args: ArgumentsCamelCase<RandomWalkerCommandArgs>) => {

//         const plusOrMinusOne = (): number => {
//             let value = Math.floor(Math.random() * 3)
//             if (value < 1) {
//                 return -1;
//             } else if (value < 2) {
//                 return 0;
//             } else if (value < 3) {
//                 return 1;
//             } else {
//                 console.log("strange thing happened");
//                 return 0;
//             }
//         }

//         const getNext = (current: SetPixelParams): SetPixelParams => {
//             return {
//                 x: (current.x + plusOrMinusOne() + PLACE_WIDTH_PX) % PLACE_WIDTH_PX,
//                 y: (current.y + plusOrMinusOne() + PLACE_HEIGHT_PX) % PLACE_HEIGHT_PX,
//                 pixel: ((current.pixel + plusOrMinusOne()) + MAX_COLORS) % MAX_COLORS,
//                 // pixel: color,
//                 payer: current.payer,
//             }
//         }

//         let keypair = loadKey(args.keyname);
//         let connection = getNewConnection();
//         let connectionConfig: ConfirmOptions = {
//             skipPreflight: true,
//             commitment: 'confirmed',
//         };

//         let color = Math.floor(Math.random() * args.colors)

//         let currentSetPixelParams = {
//             x: args.x,
//             y: args.y,
//             pixel: color,
//             payer: keypair.publicKey,
//         }

//         let allPromises: Promise<string>[] = []

//         let tx = new Transaction().add(await PlaceProgram.setPixel(currentSetPixelParams))

//         allPromises.push(sendAndConfirmTransaction(connection, tx, [keypair], connectionConfig))

//         while (true) {
//             while (allPromises.length < 100) {
//                 let sleep = new Promise((resolve) => setTimeout(resolve, 500));
//                 await sleep;
//                 currentSetPixelParams = getNext(currentSetPixelParams);
//                 console.log(currentSetPixelParams);
//                 let tx = new Transaction().add(await PlaceProgram.setPixel(currentSetPixelParams))
//                 allPromises.push(sendAndConfirmTransaction(connection, tx, [keypair], connectionConfig))
//             }

//             if (allPromises.length >= 100) {
//                 console.log("Filtering")
//                 allPromises = allPromises.filter(p => {
//                     return inspect(p).includes("pending")
//                 });

//                 while (allPromises.length > 50) {
//                     console.log("Waiting on promises")
//                     await allPromises.pop()

//                     allPromises = allPromises.filter(p => {
//                         return inspect(p).includes("pending")
//                     });
//                 }
//             }
//         }
//     }
// }

type RentCheckCommandArgs = { data_size: number };

const rent_check_command = {
    command: "rent_check",
    description: "check price of rent for a given data_size (bytes)",
    builder: (args: Argv): Argv<RentCheckCommandArgs> => {
        return args.option("data_size", {
            description: "data size (bytes)",
            type: "number",
            required: true,
        })
    },
    handler: async (args: ArgumentsCamelCase<RentCheckCommandArgs>) => {
        let result = await makeJSONRPC(
            "getMinimumBalanceForRentExemption",
            [args.data_size],
            SOLANA_MAINNET_ENDPOINT
        );

        let result_lamports = result.result as number;
        let result_sol = result_lamports / 1_000_000_000;
        let result_USD = result_sol * 100;
        console.log("Lamps: ", result_lamports, "\nSOL: ", result_sol, "\nUSD: ", result_USD);
    }
}

type UpdatePlaceStateArgs =
    { new_owner?: string } &
    { is_frozen?: boolean } &
    { paintbrush_price?: number } &
    { paintbrush_cooldown?: number } &
    { bomb_price?: number } &
    KeynameOptionArgs

const update_place_state_command = {
    command: "update_place",
    description: "Update the place state account data",
    builder: (args: Argv): Argv<UpdatePlaceStateArgs> => {
        return applyKeynameOption(args)
            .option("new_owner", {
                description: "(Optional) change the owner to this public key",
                type: "string",
                required: false,
            })
            .option("is_frozen", {
                description: "(Optional) change the is_frozen state of the place",
                type: "boolean",
                required: false,
            })
            .option("paintbrush_price", {
                description: "(Optional) update the price for a paintbrush",
                type: "number",
                required: false,
            })
            .option("paintbrush_cooldown", {
                description: "(Optional) update the default cooldown for paintbrushes",
                type: "number",
                required: false,
            })
            .option("bomb_price", {
                description: "(Optional) update the price for bombs",
                type: "number",
                required: false,
            })
    },
    handler: async (args: ArgumentsCamelCase<UpdatePlaceStateArgs>) => {

        let new_owner = args.new_owner ? new PublicKey(args.new_owner!) : null;
        let is_frozen = args.is_frozen ? args.is_frozen! : null;
        let paintbrush_price = args.paintbrush_price ? new BN(args.paintbrush_price!) : null;
        let paintbrush_cooldown = args.paintbrush_cooldown ? new BN(args.paintbrush_cooldown!) : null;
        let bomb_price = args.bomb_price ? new BN(args.bomb_price!) : null;

        let key = loadKey(args.keyname);

        let update_place_ix = await PlaceProgram.updatePlaceState({
            current_owner: key.publicKey,
            new_owner: new_owner,
            is_frozen: is_frozen,
            paintbrush_price: paintbrush_price,
            paintbrush_cooldown: paintbrush_cooldown,
            bomb_price: bomb_price,
        })

        let tx = new Transaction().add(update_place_ix);
        let connection = getNewConnection();
        let result = await sendAndConfirmTransaction(connection, tx, [key]);
        console.log("Result: ", result);
    }
}

type PurchaseGameplayTokenCommandArgs =
    KeynameOptionArgs &
    { type: string }

const purchase_gameplay_token_command = {
    command: "purchase_token",
    description: "Purchase a gameplay token",
    builder: (args: Argv): Argv<PurchaseGameplayTokenCommandArgs> => {
        return applyKeynameOption(args)
            .option("type", {
                description: "Token type to purchase",
                type: "string",
                required: true,
                choices: ["paintbrush", "bomb"],
            })
    },
    handler: async (args: ArgumentsCamelCase<PurchaseGameplayTokenCommandArgs>) => {
        let keypair = loadKey(args.keyname);
        let type: GameplayTokenType = GameplayTokenType.PaintBrush;
        let currentState = await PlaceClient.getInstance().fetchPlaceStateAccount();
        let desired_price = currentState.paintbrush_price;
        switch (args.type) {
            case "paintbrush":
                type = GameplayTokenType.PaintBrush;
                desired_price = currentState.paintbrush_price;
                break;
            case "bomb":
                type = GameplayTokenType.Bomb;
                desired_price = currentState.bomb_price;
                break;
        }

        let ix = await PlaceProgram.purchaseGameplayToken({
            token_type: type,
            desired_price: desired_price,
            payer: keypair.publicKey,
        })

        let tx = new Transaction().add(ix);

        let connection = getNewConnection();
        let result = await sendAndConfirmTransaction(connection, tx, [keypair]);
        console.log(result);
    }
}

type ClaimTokensCommandArgs =
    KeynameOptionArgs &
    { gpt_acct: string }

const claim_tokens_command = {
    command: "claim",
    description: "Claim place tokens from a gameplay token account (use pla get gameplay_tokens to get addresses)",
    builder: (args: Argv): Argv<ClaimTokensCommandArgs> => {
        return applyKeynameOption(args)
            .option("gpt_acct", {
                description: "The gameplay token account to claim tokens from (base58 string)",
                type: "string",
                required: true
            })
    },
    handler: async (args: ArgumentsCamelCase<ClaimTokensCommandArgs>) => {
        let claimer = loadKey(args.keyname);
        let connection = getNewConnection();
        let gps_acct_pubkey = new PublicKey(args.gpt_acct);
        let gpt_acct_info = await connection.getAccountInfo(gps_acct_pubkey);
        if (gpt_acct_info == null) {
            console.log("Gameplay token not found: ", gps_acct_pubkey.toBase58());
            return;
        }

        let gpt_acct = new GameplayTokenMetaAccount(gps_acct_pubkey, gpt_acct_info);
        console.log("Got GPT Acct: ", gpt_acct.pubkey.toBase58())
        console.log("Tokens Claimable: ", gpt_acct.data.place_tokens_owed);

        let place_state_pda = await PlaceProgram.findPlaceTokenMintPda();

        let token_accounts = await connection.getTokenAccountsByOwner(claimer.publicKey, {
            mint: place_state_pda,
        })

        if (token_accounts.value.length > 1) {
            console.log("WARNING: multiple ATA accounts (", token_accounts.value.length, ") exist for keypair: ", args.keyname);
        }

        let tx = new Transaction();
        let dest_ata: PublicKey | null = null

        if (token_accounts.value.length == 0) {
            console.log("creating place tokens ATA for keyname: ", args.keyname);
            let ata = await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                place_state_pda,
                claimer.publicKey,
                true, // TODO(will): what are the implications of this?
            );

            let create_ata_ix = Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                place_state_pda,
                ata,
                claimer.publicKey,
                claimer.publicKey,
            )


            tx.add(create_ata_ix);
            dest_ata = ata;

            // let result = await connection.sendTransaction(tx, [claimer]);
            // console.log("Result: ", result);
        }

        if (dest_ata == null) {
            dest_ata = token_accounts.value[0].pubkey;
        }

        // in theory this could be wrong, but should generally be correct
        let gpt_ata = await PlaceProgram.findGameplayTokenMintAta(gpt_acct.data.token_mint_pda, claimer.publicKey);
        console.log("GPT ATA: ", gpt_ata.toBase58());

        let claim_tokens_ix = await PlaceProgram.claimTokens({
            claimer: claimer.publicKey,
            gameplay_token_random_seed: gpt_acct.data.random_seed,
            gameplay_token_ata: gpt_ata,
            dest_ata: dest_ata
        })

        console.log(inspect(claim_tokens_ix.keys, true, null, true));

        // let tx = new Transaction();
        tx.add(claim_tokens_ix)

        let result = await connection.sendTransaction(tx, [claimer], {});
        console.log("Result: ", result);

        let confirmation = await connection.confirmTransaction(result, "finalized");
        console.log("confirmation: ", confirmation);

        let dest_ata_balance = await connection.getTokenAccountBalance(dest_ata);
        console.log("Keyname ", args.keyname, " now has ", dest_ata_balance.value, " place tokens");
    }
}

const get_state_command = {
    command: "get_state",
    description: "Get the current Place State account and print contents",
    handler: async (args: ArgumentsCamelCase) => {
        let state = await PlaceClient.getInstance().fetchPlaceStateAccount();
        console.log("Place State:")
        console.log("AcctType     :", state.acct_type);
        console.log("Owner        :", state.owner.toBase58());
        console.log("Frozen?      :", state.is_frozen);
        console.log("Pbrush price :", state.paintbrush_price.toNumber());
        console.log("Pbrush cool  :", state.paintbrush_cooldown.toNumber());
        console.log("Bomb price   :", state.bomb_price.toNumber());
        // console.log("Raw: ")
        // console.log(inspect(state, true, null, true))
    }
}

export const command = {
    command: "tx",
    description: "Execute various transations against the tapestry program running on the solana blockchain",
    builder: (argv: Argv) => {
        return argv
            // .command(set_pixel_command)
            // .command(random_walker_command)
            .command(init_all_patches_command)
            .command(init_mint_command)
            .command(rent_check_command)
            .command(update_place_state_command)
            .command(get_state_command)
            .command(purchase_gameplay_token_command)
            .command(claim_tokens_command)
            .demandCommand()
    }
}