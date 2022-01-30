import { Keypair, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'
import yargs, { ArgumentsCamelCase, Argv, number, string } from 'yargs'
import { applyKeynameOption, applyXYArgOptions, KeynameOptionArgs, XYOptionArgs } from '../../cli_utils/commandHelpers'
import { getNewConnection, loadKey } from '../../cli_utils/utils'
import { PlaceProgram, SetPixelParams } from '../client/src/PlaceProgram'

type SetPixelCommandArgs =
    XYOptionArgs &
    KeynameOptionArgs &
    { r: number } &
    { g: number } &
    { b: number }

const set_pixel_command = {
    command: "set_pixel",
    description: "set a pixel to an rgb value",
    builder: (args: Argv): Argv<SetPixelCommandArgs> => {
        return applyXYArgOptions(applyKeynameOption(args))
            .option("r", {
                description: "red value",
                type: "number",
                required: true,
            })
            .option("g", {
                description: "green value",
                type: "number",
                required: true,
            })
            .option("b", {
                description: "blue value",
                type: "number",
                required: true,
            })
    },
    handler: async (args: ArgumentsCamelCase<SetPixelCommandArgs>) => {
        let payer = loadKey(args.keyname);
        let connection = getNewConnection();
        let pixelValue = [0, 0, 0];

        let params: SetPixelParams = {
            x: args.x,
            y: args.y,
            pixel: [args.r, args.g, args.b],
            payer: payer.publicKey,
        }

        let ix = await PlaceProgram.setPixel(params);
        let tx = new Transaction().add(ix);
        let sig = await sendAndConfirmTransaction(connection, tx, [payer]);
        let result = await connection.confirmTransaction(sig, "confirmed");

        console.log("Sig: ", sig);
        console.log("Err: ", result.value.err);
    }
}

export const command = {
    command: "tx",
    description: "Execute various transations against the tapestry program running on the solana blockchain",
    builder: (argv: Argv) => {
        return argv
            .command(set_pixel_command)
            .demandCommand()
    }
}
