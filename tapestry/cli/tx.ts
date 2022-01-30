
import yargs, { ArgumentsCamelCase, Argv, number, string } from 'yargs'
import { TapestryProgram } from '../client/src/TapestryProgram'
import { FeaturedStateAccount } from '../client/src/accounts/FeaturedState'
import { ConfirmOptions, LAMPORTS_PER_SOL, sendAndConfirmRawTransaction, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import {
    MaybePatternPatch,
    Pattern,
    getBalance,
    getNewConnection,
    getRawTransaction,
    loadKey,
    loadKeyFromPath,
    loadPatternFromPath,
    makeJSONRPC,
    getPreparedTransaction
} from '../../cli_utils/utils'

import { applyKeynameOption, applyXYArgOptions, applyRectOption, KeynameOptionArgs, RectOptionArgs } from '../../cli_utils/commandHelpers'
import { inspect } from 'util';
import fs from 'fs';
import base58 from 'bs58'
import path from 'path'

const init_command = {
    command: "init",
    describe: "Initialize a new tapestry",
    builder: (argv: Argv) => {
        return argv
            .option("keyname", {
                describe: "keypair to use to initialize the tapestry",
                type: "string",
                demand: true,
            })
            .option("price", {
                describe: "The price to set for the tapestry patches",
                type: "number",
                default: 0.01,
            })
    },
    handler: async (args: ArgumentsCamelCase) => {
        let keypair = loadKey(args.keyname as string);
        let price = args.price as number;

        let connection = getNewConnection()

        let ix = await TapestryProgram.initTapestry({
            initialSalePrice: price,
            ownerPubkey: keypair.publicKey,
        });

        let tx = new Transaction().add(ix);

        let rawTx = await getRawTransaction(connection, tx, [keypair])

        console.log("TX Bytes: " + rawTx.length)

        let signature = await sendAndConfirmRawTransaction(connection, rawTx);
        let result = await connection.confirmTransaction(signature, "confirmed");

        console.log("TX Sig: " + signature);
        console.log("Err: " + result.value.err);
    }
}

type PushFeaturedArgs =
    { callout: string } &
    { sol_domain: string } &
    RectOptionArgs &
    KeynameOptionArgs

const push_featured_command = {
    command: "pushfeat",
    description: "Add a featured",
    builder: (args: Argv): Argv<PushFeaturedArgs> => {
        return applyRectOption(applyKeynameOption(args))
            .option("callout", {
                describe: "Callout text for this featured element",
                type: "string",
                required: true,
            })
            .option("sol_domain", {
                describe: "The sol domain for attribution",
                type: "string",
                required: true,
            });
    },
    handler: async (args: ArgumentsCamelCase<PushFeaturedArgs>) => {
        let keypair = loadKey(args.keyname)
        let connection = getNewConnection();

        let params = {
            time_ms: (new Date()).getTime(),
            x: args.x,
            y: args.y,
            width: args.width,
            height: args.height,
            callout: args.callout,
            sol_domain: args.sol_domain,
            owner: keypair.publicKey,
        }

        let push_featured_ix = await TapestryProgram.pushFeatured(params);

        let tx = new Transaction().add(push_featured_ix);

        let rawTx = await getRawTransaction(connection, tx, [keypair])

        console.log("TX Bytes: " + rawTx.length);

        let signature = await sendAndConfirmRawTransaction(connection, rawTx);
        let result = await connection.confirmTransaction(signature, "confirmed");

        console.log("TX Sig: ", signature);
        console.log("Err: ", result.value.err);

        let state = await FeaturedStateAccount.fetchFeaturedState(connection);
        console.log(inspect(state, true, null, true))
    }
}

const airdrop_command = {
    command: "airdrop",
    describe: "get money from faucet for the provided [keyname]",
    builder: (argv: Argv) => {
        return applyKeynameOption(argv)
            .option("amount", {
                describe: "Amount to airdrop",
                type: "number",
                default: 100,
            })
    },
    handler: async (args: ArgumentsCamelCase) => {
        let keypair = loadKey(args.keyname as string)
        let amount = args.amount as number;
        let connection = getNewConnection();
        let result = await connection.requestAirdrop(keypair.publicKey, amount * LAMPORTS_PER_SOL);
        console.log(result);
    }
}

const buy_command = {
    command: "buy",
    describe: "buy a patch",
    builder: (args: Argv) => {
        return applyKeynameOption(applyXYArgOptions(args))
    },
    handler: async (args: ArgumentsCamelCase) => {
        let keypair = loadKey(args.keyname as string);
        let x = args.x as number;
        let y = args.y as number;

        console.log("Purchasing Patch at " + x + "," + y);

        let ix = await TapestryProgram.purchasePatch({
            x: x,
            y: y,
            buyerPubkey: keypair.publicKey,
        });

        let tx = new Transaction().add(ix);
        let connection = getNewConnection();

        let preppedTx = await getPreparedTransaction(connection, tx, [keypair])
        console.log("Prepped Sig: " + base58.encode(preppedTx.signature as Buffer))

        let rawTx = preppedTx.serialize()
        console.log("TX Bytes: " + rawTx.length)

        let sig = await sendAndConfirmRawTransaction(connection, rawTx)
        console.log("TX Sig: " + sig);

        let result = await connection.confirmTransaction(sig, "confirmed");
        console.log("TX Err: " + result.value.err)
    }
}

const upload_image = {
    command: "imageup",
    description: "upload image to a patch",
    builder: (args: Argv) => {
        return applyKeynameOption(applyXYArgOptions(args))
            .option("path", {
                describe: "a path to the gif to upload",
                type: "string",
                required: true,
            })
    },
    handler: async (args: ArgumentsCamelCase) => {
        let path = args.path as string
        let x = args.x as number
        let y = args.y as number
        let keypair = loadKey(args.keyname as string)

        let image_data = new Uint8Array(fs.readFileSync(path))
        console.log("image bytes: " + image_data.length)

        let ix = await TapestryProgram.updatePatchImage({
            x: x,
            y: y,
            image_data: image_data,
            owner: keypair.publicKey
        })
        let tx = new Transaction().add(ix)

        let connection = getNewConnection();
        let txRaw = await getRawTransaction(connection, tx, [keypair])
        console.log("TX Bytes: " + txRaw.length)

        let sig = await sendAndConfirmRawTransaction(connection, txRaw)
        console.log("TX Sig: " + sig);

        let result = await connection.getConfirmedTransaction(sig, "confirmed")

        console.log("TX Info: \n" + inspect(result, true, null, true))
    }
}

const upload_meta = {
    command: "metaup",
    description: "upload metadata to a patch",
    builder: (args: Argv) => {
        return applyKeynameOption(applyXYArgOptions(args))
            .option("url", {
                description: "Redirect URL for the patch",
                type: "string",
            })
            .option("hover_text", {
                description: "hover text for the patch",
                type: "string"
            })
    },
    handler: async (args: ArgumentsCamelCase) => {
        let x = args.x as number
        let y = args.y as number
        let keypair = loadKey(args.keyname as string)

        let ix = await TapestryProgram.updatePatchMetadata({
            x: x,
            y: y,
            owner: keypair.publicKey,
            url: args.url as string,
            hover_text: args.hover_text as string
        })

        let tx = new Transaction().add(ix)

        let connection = getNewConnection();
        let txRaw = await getRawTransaction(connection, tx, [keypair])
        console.log("TX Bytes: " + txRaw.length)

        let sig = await sendAndConfirmRawTransaction(connection, txRaw)
        console.log("TX Sig: " + sig)

        let result = await connection.getConfirmedTransaction(sig, "confirmed")
        console.log("TX Info: \n" + inspect(result, true, null, true))
    }
}

type FillCommandArgs =
    { x: number } &
    { y: number } &
    { width: number } &
    { height: number } &
    { pattern: string } &
    { keyname: string } &
    { buyEmpty: boolean }

const fill_pattern_command = {
    command: "fillpattern",
    description: "buy and fill an area with a pattern",
    builder: (args: Argv): Argv<FillCommandArgs> => {
        return applyKeynameOption(args)
            .option("x", {
                description: "lower left x coordinate of the pattern",
                type: "number",
                required: true,
            })
            .option("y", {
                description: "lower left y coordinate of the pattern",
                type: "number",
                required: true,
            })
            .option("width", {
                description: "the width of the pattern rect",
                type: "number",
                required: true,
            })
            .option("height", {
                description: "the height of the pattern rect",
                type: "number",
                required: true,
            })
            .option("pattern", {
                description: "path to the root of a directory containing a pattern.json and gifs",
                type: "string",
                required: true,
            })
            .option("buyEmpty", { default: false })
    },
    handler: async (args: ArgumentsCamelCase<FillCommandArgs>) => {

        let keypair = loadKey(args.keyname)
        let connection = getNewConnection();
        let pattern = await loadPatternFromPath(args.pattern)
        let totalPatches = args.width * args.height

        // console.log("Pattern: \n" + inspect(pattern, true, null, true));
        console.log("Buyer Pubkey : " + keypair.publicKey)
        console.log("Buyer Balance (SOL) : " + await getBalance(keypair.publicKey))
        console.log("Bottom Left: x=" + args.xLeft + " y=" + args.yBot)
        console.log("Top Right x=" + args.xRight + " y=" + args.yTop)
        console.log("Total Patches = " + totalPatches)

        let allPromises: Promise<string>[] = []

        const getPatch = (x: number, y: number): MaybePatternPatch => {
            let patternX = (x - args.x) % pattern.patches[0].length;
            let patternY = (pattern.patches.length - 1) - ((y - args.y) % pattern.patches.length);
            return pattern.patches[patternY][patternX];
        }

        const yTop = args.y + args.height;
        const xRight = args.x + args.width;

        for (let y = args.y; y < yTop; y++) {
            for (let x = args.x; x < xRight; x++) {

                if (allPromises.length > 100) {
                    allPromises = allPromises.filter(p => {
                        return inspect(p).includes("pending")
                    });

                    while (allPromises.length > 50) {
                        console.log("Waiting on promises")
                        await allPromises.pop()

                        allPromises = allPromises.filter(p => {
                            return inspect(p).includes("pending")
                        });
                    }
                }

                const patch = getPatch(x, y)

                if (!args.buyEmpty && patch === null) {
                    continue
                }

                let tx = new Transaction().add(await TapestryProgram.purchasePatch({
                    x: x,
                    y: y,
                    buyerPubkey: keypair.publicKey
                }))

                let txConfig: ConfirmOptions = { skipPreflight: true, commitment: "confirmed" }
                let updatePromise = sendAndConfirmTransaction(connection, tx, [keypair], txConfig).then(async (value) => {
                    console.log("Confirmed Purchase: " + x + " , " + y + "  SIG: " + value)

                    if (patch === null || patch.imageBuffer === undefined) {
                        return "no image upload"
                    }

                    let imageData = new Uint8Array(patch.imageBuffer);

                    console.log("Data len: ", imageData.length)

                    let tx = new Transaction().add(await TapestryProgram.updatePatchImage({
                        x: x,
                        y: y,
                        owner: keypair.publicKey,
                        image_data: imageData,
                    }));

                    return sendAndConfirmTransaction(connection, tx, [keypair], txConfig)
                }).then(async (value) => {
                    if (value != "no upload") {
                        console.log("Confirmed Upload: " + x + " , " + y + "  SIG: " + value)
                    }

                    if (patch === null || (patch.url === null && patch.hoverText === null)) {
                        return "no meta upload"
                    }

                    const url = patch.url
                    const hoverText = patch.hoverText

                    if (!url && !hoverText) {
                        return "no meta"
                    }

                    let tx = new Transaction().add(await TapestryProgram.updatePatchMetadata({
                        x: x,
                        y: y,
                        owner: keypair.publicKey,
                        url: url,
                        hover_text: hoverText
                    }));

                    return sendAndConfirmTransaction(connection, tx, [keypair], txConfig)
                }).then((value) => {
                    if (value != "no meta" && value != "no upload") {
                        console.log("Confirmed meta " + x + " , " + y + "  SIG: " + value);
                    }

                    return "done"
                }).catch((reason) => {
                    console.log("TX Failed: ", inspect(reason, true, null, true))
                    return "failed"
                })

                allPromises.push(updatePromise)
            }
        }

        for (var i = 0; i < allPromises.length; i++) {
            let result = await allPromises[i];
            console.log("Promise Completed: " + result)
        }
    }
}

export const command = {
    command: "tx",
    description: "Execute various transations against the tapestry program running on the solana blockchain",
    builder: (argv: Argv) => {
        return argv
            .command(airdrop_command)
            .command(init_command)
            .command(buy_command)
            .command(upload_image)
            .command(upload_meta)
            .command(fill_pattern_command)
            .command(push_featured_command)
            .demandCommand()
    }
}

