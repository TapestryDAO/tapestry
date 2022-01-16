import yargs, { Argv, requiresArg } from 'yargs'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { TapCommand } from './commands/command'


// Parse commands from the commands directory
const commands = fs.readdirSync("./commands")
    .filter((value) => value.endsWith(".ts") && value != "command.ts")
    .map((value) => {
        return require("./commands/" + value).command as TapCommand
    });

// Parse arguments
let args: Argv = commands.reduce((args, cmd) => {
    return args.command(cmd.keyword, cmd.description, cmd.command)
}, yargs);

args.argv