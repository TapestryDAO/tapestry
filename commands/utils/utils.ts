import path from 'path'
import * as fs from 'fs'
import { Keypair, Connection, ConnectionConfig } from '@solana/web3.js'


export const KEYS_DIR = path.resolve(__dirname, "..", "keys")


// NOTE(will): At some point we probably will want to swap configs between local / testnet / mainnet
// So hiding hese constants here and accessing indirectly 

const SOLANA_ENDPOINT_LOCAL = "http://127.0.0.1:8899"

const SOLANA_CONFIG_LOCAL: ConnectionConfig = {
    commitment: "confirmed",
}

export const getNewConnection = (): Connection => {
    return new Connection(SOLANA_ENDPOINT_LOCAL, SOLANA_CONFIG_LOCAL)
}

export const getKeyPath = (keyname: string): string => {
    return path.resolve(KEYS_DIR, keyname + ".json")
}

export const loadKey = (keyname: string): Keypair => {
    const keyPath = getKeyPath(keyname)
    const data = fs.readFileSync(keyPath, 'utf8');
    const dataJson = JSON.parse(data);
    return Keypair.fromSecretKey(Uint8Array.from(dataJson));
}