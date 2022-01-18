import path from 'path'
import * as fs from 'fs'
import { Keypair, Connection, ConnectionConfig, TransactionSignature, Transaction, Signer, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { execSync, exec } from 'child_process'
import axios from 'axios';
import { exit } from 'process';
import { inspect } from 'util';

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

export const loadPatternFromPath = (path: string): number[][] => {
    const data = fs.readFileSync(path, 'utf-8');
    const dataJson = JSON.parse(data);
    return dataJson as [number[]]
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

    if (fs.existsSync(keyPath)) {
        console.log("A key already exists at " + keyPath)
        exit(1)
    }

    console.log("Generating random keypair to " + keyPath)
    let command = ["solana-keygen", "new", "-o", keyPath, "--no-bip39-passphrase"]
    execSync(command.join(" "))
}

export const generateVanityKey = (keyname: string, vanity: string) => {
    const keyPath = path.resolve(KEYS_DIR, keyname + ".json")

    if (fs.existsSync(keyPath)) {
        console.log("A key already exists at " + keyPath)
        exit(1)
    }

    console.log("Grinding for a keypair starting with: " + vanity)
    const command = [
        "cd", KEYS_DIR, "&&",
        "solana-keygen", "grind", "--starts-with", vanity + ":1", "--no-bip39-passphrase"]

    let output = execSync(command.join(" ")).toString('utf-8')
    let regexStr = "\\b" + vanity + "[\\w]*?\\.json"
    let findKeynameRegex = new RegExp(regexStr)
    let keypairFilename = output.match(findKeynameRegex)![0]
    console.log("Found: " + keypairFilename.replace(".json", ""));
    console.log("Saving to " + keyPath);
    let mv_command = [
        "mv", path.resolve(KEYS_DIR, keypairFilename), keyPath
    ]

    let moveResult = execSync(mv_command.join(" "))
}

export const confirmTxWithRetry = async (connection: Connection, sig: TransactionSignature, maxRetries: number = 3) => {
    let count = maxRetries;

    while (count > 0) {
        try {
            return await connection.confirmTransaction(sig, "confirmed")
        } catch (e) {
            console.log("Error Confirming TX: " + sig + "\n" + inspect(e, true, null, true))
            count -= 1;
        }
    }

    return null;
}

export const getBalance = async (key: PublicKey) => {
    let lamports = await getNewConnection().getBalance(key)
    return lamports / LAMPORTS_PER_SOL
}

// NOTE(will): Copy pasted and tweaked slightly such that I can get raw tx wire bytes
export const getPreparedTransaction = async (
    connection: Connection,
    transaction: Transaction,
    signers: Array<Signer>,
): Promise<Transaction> => {
    if (transaction.nonceInfo) {
        transaction.sign(...signers);
    } else {
        // @ts-expect-error
        let disableCache = connection["_disableBlockhashCaching"];
        // let disableCache = true
        for (; ;) {
            // @ts-expect-error
            transaction.recentBlockhash = await connection["_recentBlockhash"](disableCache);
            transaction.sign(...signers);
            // @ts-expect-error
            const signature = transaction.signature.toString('base64');
            // @ts-expect-error
            if (!connection["_blockhashInfo"]["transactionSignatures"].includes(signature)) {
                // The signature of this transaction has not been seen before with the
                // current recentBlockhash, all done. Let's break
                // @ts-expect-error
                connection["_blockhashInfo"]["transactionSignatures"].push(signature);
                break;
            } else {
                // This transaction would be treated as duplicate (its derived signature
                // matched to one of already recorded signatures).
                // So, we must fetch a new blockhash for a different signature by disabling
                // our cache not to wait for the cache expiration (BLOCKHASH_CACHE_TIMEOUT_MS).
                disableCache = true;
            }
        }
    }

    return transaction
}

export const getRawTransaction = async (
    connection: Connection,
    transaction: Transaction,
    signers: Array<Signer>,
): Promise<Buffer> => {
    const tx = await getPreparedTransaction(connection, transaction, signers)
    return tx.serialize()
}

class CheckablePromise<T> extends Promise<T> {
    isPending = true
    isFullfilled = false
    isRejected = false
}

