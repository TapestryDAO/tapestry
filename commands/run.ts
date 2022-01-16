
import { TapCommand } from "./command"
import yargs, { ArgumentsCamelCase, Argv } from 'yargs'

import { TapestryProgram } from '../client/src/TapestryProgram'
import { LAMPORTS_PER_SOL, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import { getNewConnection, loadKey } from './utils/utils'

const initTapestry = async (args: ArgumentsCamelCase) => {
    let keypair = loadKey(args.keyname as string);
    let price = args.price as number;

    let connection = getNewConnection()

    let ix = await TapestryProgram.initTapestry({
        initialSalePrice: price,
        ownerPubkey: keypair.publicKey,
    });

    let tx = new Transaction().add(ix);

    let signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
    let result = await connection.confirmTransaction(signature, "confirmed");

    console.log('Result: ${result}');
    console.log('Result: ' + result);
    console.log('Result: ' + result.value);
    console.log('Result: ' + result.value.err)
}

const airdropFn = async (args: ArgumentsCamelCase) => {
    let keypair = loadKey(args.keyname as string)
    let amount = args.amount as number;
    let connection = getNewConnection();

    let result = await connection.requestAirdrop(keypair.publicKey, amount * LAMPORTS_PER_SOL);
    console.log(result);
}

const initTapestryBuilder = (args: Argv) => {
    return args.option("keyname", {
        describe: "keypair to use to initialize the tapestry",
        type: "string",
        demand: true,
    }).option("price", {
        describe: "The price to set for the tapestry patches",
        type: "number",
        default: 0.01,
    }).argv
}

const airdropBuilder = (args: Argv) => {
    return args.option("amount", {
        describe: "how much money you want to airdrop",
        type: "number",
        default: 100,
    }).argv
}

export const command: TapCommand = {
    keyword: "run",
    description: "interact with the tapestry",
    command: (yargs: Argv) => {
        return yargs
            .command("init", "Initialize a tapestry", initTapestryBuilder, initTapestry)
            .command("airdrop [keyname]", "Get money", airdropBuilder, airdropFn)
    }
}