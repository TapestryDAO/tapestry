import yargs, { ArgumentsCamelCase, Argv, describe, number } from 'yargs'
import { getNewConnection, makeJSONRPC } from '../../cli_utils/utils'
import util, { inspect } from 'util';
import { TapestryProgram } from '../client/src/TapestryProgram';
import { TapestryStateAccount } from '../client/src/accounts/TapestryState';
import { TapestryClient } from '../client/src/TapestryClient';
import path from 'path/posix';
import { FeaturedStateAccount } from '../client/src/accounts/FeaturedState';

const get_tx = {
    command: "sig [signature]",
    describe: "get a transaction by signature",
    builder: (argv: Argv) => {
        return argv.positional("signature", {
            describe: "The signature from the transaction",
            type: "string",
            required: true,
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
        let state = await TapestryStateAccount.fetchState(connection)
        console.log(state);
    }
}

const get_featured = {
    command: "featured",
    describe: "get the featured state",
    handler: async (args: ArgumentsCamelCase) => {
        let conneciton = getNewConnection();
        let state = await FeaturedStateAccount.fetchFeaturedState(conneciton);
        console.log(inspect(state, true, null, true));
    }
}

type GetChunkArgs =
    { x: number } &
    { y: number }


const get_chunk = {
    command: "chunk",
    describe: "Fetch a chunk of the tapestry",
    builder: (args: Argv): Argv<GetChunkArgs> => {
        return args.option("x", {
            description: "the x index of the CHUNK",
            type: "number",
            required: true
        }).option("y", {
            description: "the y index of the CHUNK",
            type: "number",
            required: true
        })
    },
    handler: async (args: ArgumentsCamelCase<GetChunkArgs>) => {
        let client = TapestryClient.getInstance()

        let chunkArray = await client.fetchChunkArray(args.x, args.y)

        let stringRepresentation = ""
        for (let y = 0; y < chunkArray.length; y++) {
            for (let x = 0; x < chunkArray.length; x++) {
                let chunk = chunkArray[y][x];
                if (!chunk) {
                    stringRepresentation += "."
                } else if (!chunk.data.image_data) {
                    stringRepresentation += "+"
                } else {
                    stringRepresentation += "@"
                }
            }
            stringRepresentation += "\n"
        }

        console.log("Chunk: \n\n" + stringRepresentation)
    }
}

export const command = {
    command: "get",
    description: "get various state from the blockchain",
    builder: (args: Argv) => {
        return args
            .command(get_tx)
            .command(get_state)
            .command(get_chunk)
            .command(get_featured)
            .demandCommand()
    }
}