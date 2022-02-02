import { Argv, describe } from 'yargs'

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