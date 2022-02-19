import yargs, { ArgumentsCamelCase, Argv, number, string } from "yargs";
import * as fs from "fs";
import { argv } from "process";
import path from "path";
import { TAPESTRY_ROOT } from "../../cli_utils/utils";

type ConvertHexToJsonCommandArgs = { inFile: string } & { name: string };

const PALLETE_OUT = path.resolve(TAPESTRY_ROOT, "place", "client", "src", "palletes");

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
            .option("name", {
                description: "pallete name",
                type: "string",
                required: true,
            });
    },
    handler: async (args: ArgumentsCamelCase<ConvertHexToJsonCommandArgs>) => {
        const data = fs.readFileSync(args.inFile, "utf8");
        const hexValues = data
            .split("\n")
            .map((value) => value.trim())
            .filter((value) => value != "");

        if (hexValues.length > 256) {
            throw Error("Invalid hex file, too many colors");
        }

        console.log("Hex file had ", hexValues.length, " colors");
        console.log(hexValues);
        console.log("Writing output json array to ", args.outFile);
        let typescriptFileContents =
            "export const " + args.name + " = " + JSON.stringify(hexValues);
        let outfile = path.resolve(PALLETE_OUT, args.name + ".ts");
        fs.writeFileSync(outfile, typescriptFileContents, "utf8");
    },
};

export const command = {
    command: "pallete",
    desctiption: "Pallete helpers",
    builder: (argv: Argv) => {
        return argv.command(convert_pallete_command).demandCommand();
    },
};
