import yargs, { ArgumentsCamelCase, Argv } from 'yargs'
import { getNewConnection, makeJSONRPC } from './utils/utils'
import util from 'util';
import { TapestryProgram } from '../client/src/TapestryProgram';
import { TapestryStateAccount } from '../client/src/accounts/TapestryState';

const get_tx = {
    command: "sig [signature]",
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
        console.log("Fetching data for signature: " + signature);
        let result = await makeJSONRPC("getTransaction", [signature, "json"])
        console.log(util.inspect(result, true, null, true))
    }
}

const get_state = {
    command: "state",
    describe: "get info on the tapestry state account",
    handler: async (args: ArgumentsCamelCase) => {
        let connection = getNewConnection();
        let state = TapestryStateAccount.fetchState(connection)
        console.log(state);
    }
}

export const command = {
    command: "get",
    description: "get various state from the blockchain",
    builder: (args: Argv) => {
        return args
            .command(get_tx)
            .demandCommand()
    }
}