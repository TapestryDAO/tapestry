import yargs, { ArgumentsCamelCase, Argv, number, string } from 'yargs'
import * as fs from 'fs'
import { argv } from 'process'

type ConvertHexToJsonCommandArgs =
    { inFile: string } &
    { outFile: string }

const convert_pallete_command = {
    command: "convert",
    description: "Convert .hex pallete to json and place at dstPath",
    builder: (args: Argv): Argv<ConvertHexToJsonCommandArgs> => {
        return args
            .option("inFile", {
                description: "Input file, should be a hex file",
                type: "string",
                required: true,
            })
            .option("outFile", {
                description: "Output file, will be a json array",
                type: "string",
                required: true,
            })
    },
    handler: async (args: ArgumentsCamelCase<ConvertHexToJsonCommandArgs>) => {
        const data = fs.readFileSync(args.inFile, 'utf8');
        const hexValues = data.split("\n").map((value) => value.trim());
        console.log(hexValues);
        console.log("Writing output json array to ", args.outFile);
        fs.writeFileSync(args.outFile, JSON.stringify(hexValues), 'utf8');
    }
}

export const command = {
    command: "pallete",
    desctiption: "Pallete helpers",
    builder: (argv: Argv) => {
        return argv
            .command(convert_pallete_command)
            .demandCommand()
    }
}