
import yargs, { ArgumentsCamelCase, Argv, number, string } from 'yargs'
import { TapestryProgram } from '../client/src/TapestryProgram'
import { LAMPORTS_PER_SOL, sendAndConfirmRawTransaction, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import { getNewConnection, getRawTransaction, loadKey, loadKeyFromPath, loadPatternFromPath, makeJSONRPC } from './utils/utils'
import { applyKeynameOption, applyXYArgOptions } from './utils/commandHelpers'
import util, { inspect } from 'util';
import { argv, exit } from 'process';
import { connect } from 'http2';
import fs from 'fs';

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

        let rawTx = await getRawTransaction(connection, tx, [keypair]);
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
    { keyname: string }

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
    },
    handler: async (args: ArgumentsCamelCase<FillCommandArgs>) => {

        const makeKey = (x: number, y: number): string => {
            return "" + x + "," + y
        }

        let keypair = loadKey(args.keyname)
        let connection = getNewConnection();

        let image_data = new Uint8Array(fs.readFileSync(args.image))
        let pattern = loadPatternFromPath(args.pattern)

        console.log("Pattern: \n" + pattern);
        console.log("Buying a rectange of patches from topLeft: "
            + makeKey(args.xLeft, args.yTop) + " botRight: " + makeKey(args.xRight, args.yBot))


        type SigMap = {
            [key: string]: Promise<string>
        }

        let purchase_sigs: SigMap = {}

        let totalPatches = (args.xRight - args.xLeft) * (args.yTop - args.yBot)
        let purchase_counter = 0;

        for (let x = args.xLeft; x < args.xRight; x++) {
            for (let y = args.yBot; y < args.yTop; y++) {
                purchase_counter += 1;
                if (purchase_counter % 100 == 0) {
                    console.log("Purchased " + purchase_counter + " patches")
                }
                let tx = new Transaction().add(await TapestryProgram.purchasePatch({
                    x: x,
                    y: y,
                    buyerPubkey: keypair.publicKey,
                }))

                try {
                    // purchase_sigs[makeKey(x, y)] = connection.sendTransaction(tx, [keypair], { skipPreflight: true })
                    purchase_sigs[makeKey(x, y)] = sendAndConfirmTransaction(connection, tx, [keypair], { skipPreflight: true })
                } catch (error) {
                    continue;
                }
            }
        }



        let upload_sigs: SigMap = {}
        let upload_counter = 0

        for (let x = args.xLeft; x < args.xRight; x++) {
            for (let y = args.yBot; y < args.yTop; y++) {
                upload_counter += 1;
                if (upload_counter % 100 == 0) {
                    console.log("Uploaded " + upload_counter + " patches")
                }

                let patternX = (x - args.xLeft) % pattern.length
                let patternY = (y - args.yBot) % pattern[0].length

                if (pattern[patternX][patternY] == 0) {
                    continue;
                }

                let tx = new Transaction().add(await TapestryProgram.updatePatchImage({
                    x: x,
                    y: y,
                    owner: keypair.publicKey,
                    image_data: image_data,
                }))

                // upload_sigs[makeKey(x, y)] = connection.sendTransaction(tx, [keypair], { skipPreflight: true })
                upload_sigs[makeKey(x, y)] = sendAndConfirmTransaction(connection, tx, [keypair], { skipPreflight: true })
            }
        }

        let check_counter = 0

        // Check all the transactions
        for (let x = args.xLeft; x < args.xRight; x++) {
            for (let y = args.yBot; y < args.yTop; y++) {

                console.log("checking " + makeKey(x, y))
                check_counter += 1;
                if (check_counter % 100 == 0) {
                    console.log("Checked " + check_counter + " patches")
                }

                // We should have a purchase sig for every x,y even if some of them failed
                let purchase_sig = await purchase_sigs[makeKey(x, y)]
                console.log("Purchase Sig: " + purchase_sig)
                let confirmed_tx = await connection.getConfirmedTransaction(purchase_sig, "confirmed")
                console.log("Confirmed TX: " + inspect(confirmed_tx, true, null, true))
                let purchase_result = await connection.confirmTransaction(purchase_sig, "singleGossip")
                if (!!purchase_result.value.err) {
                    console.log("Error With Purchase - Sig: " + purchase_sig + "\n" + inspect(purchase_result, true, null, true))
                }

                // We don't upload for every x,y so can be null
                let upload_sig_promise = upload_sigs[makeKey(x, y)]
                if (!upload_sig_promise) {
                    continue;
                }

                let upload_sig = await upload_sig_promise
                console.log("Upload Sig: " + upload_sig)
                let upload_result = await connection.confirmTransaction(upload_sig, "singleGossip")
                if (!!upload_result.value.err) {
                    console.log("Error with upload - Sig: " + upload_sig + "\n" + inspect(upload_result, true, null, true))
                }
            }
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

