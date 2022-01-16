
import yargs, { ArgumentsCamelCase, Argv, string } from 'yargs'
import { TapestryProgram } from '../client/src/TapestryProgram'
import { LAMPORTS_PER_SOL, sendAndConfirmTransaction, Transaction, TransactionSignature } from '@solana/web3.js'
import { getNewConnection, loadKey, makeJSONRPC } from './utils/utils'
import util from 'util';


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

        let signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
        let result = await connection.confirmTransaction(signature, "confirmed");

        console.log('Result: ' + result);
        console.log('Result: ' + result.value);
        console.log('Result: ' + result.value.err)
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
                demandOption: true,
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

const get_tx = {
    command: "get [signature]",
    describe: "get a transaction by signature",
    builder: (argv: Argv) => {
        return argv.positional("signature", {
            describe: "The signature from the transaction",
            type: "string",
            demandOption: true,
        })
    },
    handler: async (args: ArgumentsCamelCase) => {
        let signature = args.signature as string
        let result = await makeJSONRPC("getTransaction", [signature, "json"])
        console.log(util.inspect(result, true, null, true))
    }
}

export const command = {
    command: "tx",
    description: "Execute various transations against the tapestry program running on the solana blockchain",
    builder: (argv: Argv) => {
        return argv
            .command(airdrop_command)
            .command(init_command)
            .command(get_tx)
            .demandCommand()
    }
}