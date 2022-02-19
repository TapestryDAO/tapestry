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
import { PLACE_ENDPOINT, PLACE_VERSION } from '../client/src';

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
        let client = PlaceClient.getInstanceInit(PLACE_VERSION, PLACE_ENDPOINT);
        let connection = client.connection;
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
                tx.add(await client.placeProgram.initPatch({
                    xPatch: currentXY.x,
                    yPatch: currentXY.y,
                    payer: keypair.publicKey,
                }))
            }))

            await sendAndConfirmTransaction(connection, tx, [keypair], connectionConfig)

        }));
        console.timeEnd('xy')
        console.log("All done, hopefully nothing failed");

        client.kill();
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
        // TODO(will): allow specifying program version and endpoint args
        let placeClient = PlaceClient.getInstanceInit(PLACE_VERSION, PLACE_ENDPOINT);
        let init_mint_ix = await placeClient.placeProgram.initTokenMint({ owner: owner_keypair.publicKey })
        let tx = new Transaction().add(init_mint_ix);
        let result = await sendAndConfirmTransaction(placeClient.connection, tx, [owner_keypair]);
        console.log("Result: ", result);

        placeClient.kill();
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
//         let connection = getNewConnection(PLACE_ENDPOINT.url);
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
//         let connection = getNewConnection(PLACE_ENDPOINT.url);
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
        let placeClient = PlaceClient.getInstanceInit(PLACE_VERSION, PLACE_ENDPOINT)

        let key = loadKey(args.keyname);
        console.log("Key: ", key.publicKey.toBase58());

        let update_place_ix = await placeClient.placeProgram.updatePlaceState({
            current_owner: key.publicKey,
            new_owner: new_owner,
            is_frozen: is_frozen,
            paintbrush_price: paintbrush_price,
            paintbrush_cooldown: paintbrush_cooldown,
            bomb_price: bomb_price,
        })

        let tx = new Transaction().add(update_place_ix);
        let result = await sendAndConfirmTransaction(placeClient.connection, tx, [key]);
        console.log("Result: ", result);

        placeClient.kill();
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
        let placeClient = PlaceClient.getInstance();
        let currentState = await placeClient.fetchPlaceStateAccount();
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

        let ix = await placeClient.placeProgram.purchaseGameplayToken({
            token_type: type,
            desired_price: desired_price,
            payer: keypair.publicKey,
        })

        let tx = new Transaction().add(ix);
        let result = await sendAndConfirmTransaction(placeClient.connection, tx, [keypair]);
        console.log(result);
    }
}

type ClaimTokensCommandArgs =
    KeynameOptionArgs

const claim_tokens_command = {
    command: "claim",
    description: "Claim place tokens for a given pubkey",
    builder: (args: Argv): Argv<ClaimTokensCommandArgs> => {
        return applyKeynameOption(args)
    },
    handler: async (args: ArgumentsCamelCase<ClaimTokensCommandArgs>) => {
        let claimer = loadKey(args.keyname);
        let connection = getNewConnection(PLACE_ENDPOINT.url);
        let client = PlaceClient.getInstance();

        client.setCurrentUser(claimer.publicKey);

        let gotUserPlaceTokenAccts = false;
        let gotUserGptAccts = false;
        let once = false;

        const claimTokens = async () => {
            let ready = gotUserGptAccts && gotUserPlaceTokenAccts && !once
            if (!ready) return;
            once = true;

            let claimTxs = await client.packClaimTokensTX();

            if (claimTxs === null) {
                console.log("Nothing to claim");
                client.kill();
                return;
            }

            for (let tx of claimTxs) {
                console.log("Claiming Some Tokens")
                let sig = await connection.sendTransaction(tx, [claimer]);
                console.log("Got Sig: ", sig)
                let result = await connection.confirmTransaction(sig, "finalized");
                console.log("Got Result: ", result)
            }

            client.kill();
        }

        client.OnGameplayTokenRecordsUpdated.addMemo(async (records) => {
            gotUserGptAccts = true;
            claimTokens();
        });

        client.OnCurrentUserPlaceTokenAcctsUpdated.addMemo(async (accts) => {
            gotUserPlaceTokenAccts = true;
            claimTokens();
        })
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
            .command(purchase_gameplay_token_command)
            .command(claim_tokens_command)
            .demandCommand()
    }
}