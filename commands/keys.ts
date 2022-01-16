
import { TapCommand } from "./command"
import yargs, { ArgumentsCamelCase, Argv } from 'yargs'
import { execSync, exec } from 'child_process'
import path from 'path'
import * as fs from 'fs';
import { Keypair } from '@solana/web3.js'
import { KEYS_DIR } from './utils/utils'


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

export const command: TapCommand = {
    keyword: "keys",
    description: "utilities for creating and managing local keypairs",
    command: (yargs: Argv) => {
        return yargs
            .command("create [keyname]", "Create Keys", () => { }, createKey)
            .command("show [keyname]", "Show the private key in base58", () => { }, showKey)
    }
}