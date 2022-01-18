
import yargs, { ArgumentsCamelCase, Argv, number, string } from 'yargs'
import { TapestryProgram } from '../client/src/TapestryProgram'
import { ConfirmOptions, LAMPORTS_PER_SOL, sendAndConfirmRawTransaction, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import { confirmTxWithRetry, getBalance, getNewConnection, getRawTransaction, loadKey, loadKeyFromPath, loadPatternFromPath, makeJSONRPC, getPreparedTransaction } from './utils/utils'
import { applyKeynameOption, applyXYArgOptions } from './utils/commandHelpers'
import { inspect } from 'util';
import fs from 'fs';
import base58 from 'bs58'
import { exit } from 'process'

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

const airdrop_command = {
    command: "airdrop [keyname]",
    describe: "get money from faucet for the provided [keyname]",
    builder: (argv: Argv) => {
        return argv
            .option("amount", {
                describe: "Amount to airdrop",
                type: "number",
                default: 100,
            })
            .positional("keyname", {
                describe: "keyname to airdrop SOL to",
                type: "string",
                required: true,
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
    { yTop: number } &
    { yBot: number } &
    { xLeft: number } &
    { xRight: number } &
    { pattern: string } &
    { image: string } &
    { keyname: string } &
    { skipChecks: boolean }

const fill_pattern_command = {
    command: "fillpattern",
    description: "buy and fill an area with a pattern",
    builder: (args: Argv): Argv<FillCommandArgs> => {
        return applyKeynameOption(args)
            .option("yTop", {
                description: "y_top of region to fill",
                type: "number",
                required: true,
            })
            .option("yBot", {
                description: "y_bot of region to fill",
                type: "number",
                required: true,
            })
            .option("xLeft", {
                description: "x left of region to fill",
                type: "number",
                required: true,
            })
            .option("xRight", {
                description: "x_right of region to fill",
                type: "number",
                required: true,
            })
            .option("pattern", {
                description: "path to a pattern file",
                type: "string",
                required: true,
            })
            .option("image", {
                description: "path to an image file",
                type: "string",
                required: true,
            })
            .option("skipChecks", {
                description: "Skip checking all the signatures after purchase and upload",
                type: "boolean",
                required: false,
                default: false,
            })
    },
    handler: async (args: ArgumentsCamelCase<FillCommandArgs>) => {

        let keypair = loadKey(args.keyname)
        let connection = getNewConnection();
        let image_data = new Uint8Array(fs.readFileSync(args.image))
        let pattern = loadPatternFromPath(args.pattern)
        let totalPatches = (args.xRight - args.xLeft) * (args.yTop - args.yBot)

        console.log("Pattern: \n" + pattern);
        console.log("Buyer Pubkey : " + keypair.publicKey)
        console.log("Buyer Balance (SOL) : " + await getBalance(keypair.publicKey))
        console.log("Bottom Left: x=" + args.xLeft + " y=" + args.yBot)
        console.log("Top Right x=" + args.xRight + " y=" + args.yTop)
        console.log("Total Patches = " + totalPatches)
        console.log("Using Image at: " + args.image)

        let allPromises: Promise<string>[] = []

        for (let y = args.yBot; y < args.yTop; y++) {
            for (let x = args.xLeft; x < args.xRight; x++) {

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

                let tx = new Transaction().add(await TapestryProgram.purchasePatch({
                    x: x,
                    y: y,
                    buyerPubkey: keypair.publicKey
                }))

                let txConfig: ConfirmOptions = { skipPreflight: true, commitment: "confirmed" }
                let updatePromise = sendAndConfirmTransaction(connection, tx, [keypair], txConfig).then(async (value) => {
                    console.log("Confirmed Purchase: " + x + " , " + y + "  SIG: " + value)
                    let tx = new Transaction().add(await TapestryProgram.updatePatchImage({
                        x: x,
                        y: y,
                        owner: keypair.publicKey,
                        image_data: image_data,
                    }));

                    let patternX = (x - args.xLeft) % pattern[0].length
                    let patternY = (y - args.yBot) % pattern.length
                    let shouldUpload = pattern[patternY][patternX] != 0

                    if (shouldUpload) {
                        return sendAndConfirmTransaction(connection, tx, [keypair], txConfig)
                    } else {
                        return "no upload"
                    }
                }).then((value) => {
                    if (value != "no upload") {
                        console.log("Confirmed Upload: " + x + " , " + y + "  SIG: " + value)
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
            let sig = await allPromises[i];
            console.log("Got update sig: " + sig)
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
            .demandCommand()
    }
}

