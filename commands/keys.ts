
import yargs, { ArgumentsCamelCase, Argv } from 'yargs'
import { allKeys, generateRandomKey, loadKey } from './utils/utils'

const create_command = {
    command: "create [keyname]",
    description: "generate a new keypair in $TAPESTRY_ROOT/keys",
    handler: (args: ArgumentsCamelCase) => {
        generateRandomKey(args.keyname as string)
    },
}

const show_command = {
    command: "show [keyname]",
    description: "create and manage local keypairs stored in $TAPESTRY_ROOT/keys",
    handler: (args: ArgumentsCamelCase) => {
        const key = loadKey(args.keyname as string)
        console.log(key.publicKey.toBase58())
    }
}

const list_command = {
    command: "list",
    desicription: "list all available keypairs",
    handler: (args: ArgumentsCamelCase) => {
        let keys = allKeys();
        keys.forEach((value) => {
            console.log(value.key.publicKey.toBase58().padEnd(46, " ") + " : " + value.name)
        })
    }
}

export const command = {
    command: "keys",
    description: "create and manage local keypairs stored in $TAPESTRY_ROOT/keys",
    builder: (yargs: Argv) => {
        return yargs
            .command(create_command)
            .command(show_command)
            .command(list_command)
            .demandCommand()
    },
}