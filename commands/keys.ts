import { fstat } from 'fs'
import { TapCommand } from "./command"
import yargs, { ArgumentsCamelCase, Argv } from 'yargs'
import { execSync, exec } from 'child_process'
import path from 'path'


const KEYS_DIR = path.resolve(__dirname, "..", "keys")

const createKey = (args: ArgumentsCamelCase) => {
    console.log("Creating a key named: " + args.keyname + " in " + KEYS_DIR)
    const keypair_name = args.keyname + ".json"
    let command = ["solana-keygen", "new", "-o", path.resolve(KEYS_DIR, keypair_name), "--no-bip39-passphrase"]
    execSync(command.join(" "))
}

const showKey = (args: ArgumentsCamelCase) => {
    const keypair_path = path.resolve(KEYS_DIR, args.keyname + ".json")
    const command = ["solana-keygen", "pubkey", keypair_path]

    let result = execSync(command.join(" "))

    console.log(result.toString().trim());
}

// const createKeysBuilder = (args: Argv): Argv => {
//     console.log("builder?")
//     return args.option("keyname", {});
// }

export const command: TapCommand = {
    keyword: "keys",
    description: "utilities for creating and managing local keypairs",
    command: (yargs: Argv) => {
        return yargs
            .command("create [keyname]", "Create Keys", () => { }, createKey)
            .command("show [keyname]", "Show the private key in base58", () => { }, showKey)
    }
}