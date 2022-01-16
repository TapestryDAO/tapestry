
import yargs, { ArgumentsCamelCase, Argv, number, string } from 'yargs'
import { TapestryProgram } from '../client/src/TapestryProgram'
import { LAMPORTS_PER_SOL, sendAndConfirmRawTransaction, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import { getNewConnection, getRawTransaction, loadKey, loadKeyFromPath, makeJSONRPC } from './utils/utils'
import { applyKeynameOption, applyXYArgOptions } from './utils/commandHelpers'
import util, { inspect } from 'util';
import { argv } from 'process';
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
            .demandCommand()
    }
}

