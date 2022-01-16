
import yargs, { Argv } from 'yargs'

export type TapCommand = {
    keyword: string,
    description: string,
    command: (Argv) => Argv,
}