import { Argv, describe } from 'yargs'
import { SolanaNetwork } from '../place/client/src';
export type XYOptionArgs =
    { x: number } &
    { y: number }

export const applyXYArgOptions = <T>(args: Argv<T>, defaultX: number | null, defaultY: number | null): Argv<T & XYOptionArgs> => {
    let argsWithX;
    if (defaultX === null) {
        argsWithX = args.option("x", {
            describe: "x coordinate",
            type: "number",
            required: true,
        })
    } else {
        argsWithX = args.option("x", {
            describe: "x coordinate (default = " + defaultX + ")",
            type: "number",
            default: defaultX,
        })
    }

    let argsWithXY;

    if (defaultY === null) {
        argsWithXY = argsWithX.option("y", {
            describe: "y coordinate",
            type: "number",
            required: true,
        })
    } else {
        argsWithXY = argsWithX.option("y", {
            describe: "y coordinate (default = " + defaultY + ")",
            type: "number",
            default: defaultY,
        })
    }

    return argsWithXY
};

export type KeynameOptionArgs =
    { keyname: string }

export const applyKeynameOption = <T>(args: Argv<T>): Argv<T & KeynameOptionArgs> => {
    return args
        .option("keyname", {
            describe: "Keypair to use for the transaction",
            type: "string",
            required: true,
        })
}

export type RectOptionArgs =
    { x: number } &
    { y: number } &
    { width: number } &
    { height: number }

export const applyRectOption = <T>(args: Argv<T>): Argv<T & RectOptionArgs> => {
    return args
        .option("x", {
            describe: "X coordinate of the lower left of the rect",
            type: "number",
            required: true,
        })
        .option("y", {
            describe: "Y coordinate of the lower left of the rect",
            type: "number",
            required: true,
        })
        .option("width", {
            describe: "The width of the rect",
            type: "number",
            required: true,
        })
        .option("height", {
            describe: "the height of the rect",
            type: "number",
            required: true,
        })
};

export type ProgramOptionArgs =
    { program_id: string } &
    { network: string }

export const applyProgramOptions = <T>(args: Argv<T>): Argv<T & ProgramOptionArgs> => {
    return args
        .option("program_id", {
            description: "the name of a keypair in $KEYS_DIR/program_ids or a base58 public key",
            type: "string",
            required: false,
            default: "tapestry11111111111111111111111111111111111",
        })
        .option("network", {
            description: "Solana network to use",
            type: "string",
            choices: ["localhost", "testnet", "devnet", "mainnet-beta"],
            default: "localhost",
        })
}