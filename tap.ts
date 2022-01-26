import yargs, { Argv, requiresArg } from 'yargs'
import fs from 'fs'

const CLI_PATH = "./tapestry/cli";
// Parse commands from the commands directory
const commands = fs.readdirSync(CLI_PATH)
    .filter((value) => value.endsWith(".ts") && value != "command.ts")
    .map((value) => {
        return require(CLI_PATH + "/" + value).command
    });

// Parse arguments
let args: Argv = commands.reduce((args, cmd) => {
    return args.command(cmd)
}, yargs).demandCommand();

args.argv