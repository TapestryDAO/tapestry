import path from 'path'
import * as fs from 'fs'
import { Keypair, Connection, ConnectionConfig } from '@solana/web3.js'
import { execSync, exec } from 'child_process'
import axios from 'axios';

const TAPESTRY_ROOT = process.env.TAPESTRY_ROOT as string;

const KEYS_DIR = path.resolve(TAPESTRY_ROOT, "keys")


// NOTE(will): At some point we probably will want to swap configs between local / testnet / mainnet
// So hiding hese constants here and accessing indirectly 
const SOLANA_ENDPOINT_LOCAL = "http://127.0.0.1:8899"

const SOLANA_CONFIG_LOCAL: ConnectionConfig = {
    commitment: "confirmed",
}

const removeFileSuffix = (filename: string): string => {
    return filename.substring(0, filename.lastIndexOf("."))
}

export const makeJSONRPC = async (method: string, params: string[]) => {
    const rpcPayload = {
        jsonrpc: "2.0",
        id: 1,
        method: method,
        params: params,
    };

    let result = await axios.post(SOLANA_ENDPOINT_LOCAL, rpcPayload, {
        headers: {
            "Content-Type": "application/json"
        }
    })

    return result.data
}

export const getNewConnection = (): Connection => {
    return new Connection(SOLANA_ENDPOINT_LOCAL, SOLANA_CONFIG_LOCAL)
}

export const getKeyPath = (keyname: string): string => {
    return path.resolve(KEYS_DIR, keyname + ".json")
}

export const loadKey = (keyname: string): Keypair => {
    const keyPath = getKeyPath(keyname);
    return loadKeyFromPath(keyPath);
}

export const loadKeyFromPath = (keyPath: string): Keypair => {
    const data = fs.readFileSync(keyPath, 'utf8');
    const dataJson = JSON.parse(data);
    return Keypair.fromSecretKey(Uint8Array.from(dataJson));
}

export const allKeys = (): Array<{ key: Keypair, name: string }> => {
    return fs.readdirSync(KEYS_DIR)
        .filter((value) => value.endsWith(".json"))
        .map((value) => {
            return {
                key: loadKeyFromPath(path.resolve(KEYS_DIR, value)),
                name: removeFileSuffix(value),
            };
        })
}

export const generateRandomKey = (keyname: string) => {
    const keypairName = keyname + ".json"
    const keyPath = path.resolve(KEYS_DIR, keypairName)
    console.log("Generating random keypair to " + keyPath)
    let command = ["solana-keygen", "new", "-o", keyPath, "--no-bip39-passphrase"]
    execSync(command.join(" "))
}