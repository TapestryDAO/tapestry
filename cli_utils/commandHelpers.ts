import { Argv, describe } from 'yargs'
import { SolanaNetwork } from '../place/client/src';
export type XYOptionArgs =
    { x: number } &
    { y: number }

export const applyXYArgOptions = <T>(args: Argv<T>): Argv<T & XYOptionArgs> => {
    return args
        .option("x", {
            describe: "X coordinate of the patch",
            type: "number",
            required: true,
        })
        .option("y", {
            describe: "Y coordinate of the patch",
            type: "number",
            required: true,
        })
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

// export type ProgramOptionArgs =
//     { program_id: string } &
//     { network: string }

// export const applyProgramOption = <T>(args: Argv<T>): Argv<T & ProgramOptionArgs> => {
//     return args
//         .option("program_id", {
//             describe: "the name of a keypair in $KEYS_DIR/program_ids",
//             type: "string",
//             required: false,
//         })
//         .option("network", {
//             describe: "Solana network to use",
//             type: "string",
//             default: "" + SolanaNetwork.Localhost,
//         })
// }