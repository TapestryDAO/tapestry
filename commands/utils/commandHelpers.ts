import { Argv } from 'yargs'

export const applyXYArgOptions = (args: Argv) => {
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

export const applyKeynameOption = (args: Argv) => {
    return args
        .option("keyname", {
            describe: "Keypair to use for the transaction",
            type: "string",
            required: true,
        })
}