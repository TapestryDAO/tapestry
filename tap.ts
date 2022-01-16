import yargs, { Argv, requiresArg } from 'yargs'
import fs from 'fs'


// Parse commands from the commands directory
const commands = fs.readdirSync("./commands")
    .filter((value) => value.endsWith(".ts") && value != "command.ts")
    .map((value) => {
        return require("./commands/" + value).command
    });

// Parse arguments
let args: Argv = commands.reduce((args, cmd) => {
    return args.command(cmd)
}, yargs).demandCommand();

args.argv