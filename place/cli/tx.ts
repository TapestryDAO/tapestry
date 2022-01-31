import { Keypair, sendAndConfirmTransaction, Transaction, ConfirmOptions } from '@solana/web3.js'
import { inspect } from 'util'
import yargs, { ArgumentsCamelCase, Argv, number, string } from 'yargs'
import { applyKeynameOption, applyXYArgOptions, KeynameOptionArgs, XYOptionArgs } from '../../cli_utils/commandHelpers'
import { getNewConnection, loadKey } from '../../cli_utils/utils'
import { PlaceProgram, SetPixelParams } from '../client/src/PlaceProgram'

type SetPixelCommandArgs =
    XYOptionArgs &
    KeynameOptionArgs &
    { c: number }

const set_pixel_command = {
    command: "set_pixel",
    description: "set a pixel to an rgb value",
    builder: (args: Argv): Argv<SetPixelCommandArgs> => {
        return applyXYArgOptions(applyKeynameOption(args))
            .option("c", {
                description: "8 bit color value, 0-255",
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
            pixel: args.c,
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

type RandomWalkerCommandArgs =
    XYOptionArgs &
    KeynameOptionArgs

const PLACE_WIDTH = 1000;
const PLACE_HEIGHT = 1000;
const MAX_COLORS = 256;

const random_walker_command = {
    command: "walker",
    description: "start an infinite random walker",
    builder: (args: Argv): Argv<RandomWalkerCommandArgs> => {
        return applyKeynameOption(applyXYArgOptions(args))
    },
    handler: async (args: ArgumentsCamelCase<RandomWalkerCommandArgs>) => {

        const plusOrMinusOne = (): number => {
            let value = Math.floor(Math.random() * 3)
            if (value < 1) {
                return -1;
            } else if (value < 2) {
                return 0;
            } else if (value < 3) {
                return 1;
            } else {
                console.log("strange thing happened");
                return 0;
            }
        }

        const getNext = (current: SetPixelParams): SetPixelParams => {
            return {
                x: (current.x + plusOrMinusOne() + PLACE_WIDTH) % PLACE_WIDTH,
                y: (current.y + plusOrMinusOne() + PLACE_HEIGHT) % PLACE_HEIGHT,
                // pixel: ((current.pixel + plusOrMinusOne()) + MAX_COLORS) % MAX_COLORS,
                pixel: color,
                payer: current.payer,
            }
        }

        let keypair = loadKey(args.keyname);
        let connection = getNewConnection();
        let connectionConfig: ConfirmOptions = {
            skipPreflight: true,
            commitment: 'confirmed',
        };

        let color = Math.floor(Math.random() * 256)

        let currentSetPixelParams = {
            x: args.x,
            y: args.y,
            pixel: color,
            payer: keypair.publicKey,
        }

        let allPromises: Promise<string>[] = []

        let tx = new Transaction().add(await PlaceProgram.setPixel(currentSetPixelParams))

        allPromises.push(sendAndConfirmTransaction(connection, tx, [keypair], connectionConfig))

        while (true) {
            while (allPromises.length < 100) {
                currentSetPixelParams = getNext(currentSetPixelParams);
                console.log(currentSetPixelParams);
                let tx = new Transaction().add(await PlaceProgram.setPixel(currentSetPixelParams))
                allPromises.push(sendAndConfirmTransaction(connection, tx, [keypair], connectionConfig))
            }

            if (allPromises.length >= 100) {
                console.log("Filtering")
                allPromises = allPromises.filter(p => {
                    return inspect(p).includes("pending")

                });

                while (allPromises.length > 50) {
                    console.log("Waiting on promises")
                    await allPromises.pop()

                    allPromises = allPromises.filter(p => {
                        return inspect(p).includes("pending")
                    });
                }
            }
        }
    }
}

export const command = {
    command: "tx",
    description: "Execute various transations against the tapestry program running on the solana blockchain",
    builder: (argv: Argv) => {
        return argv
            .command(set_pixel_command)
            .command(random_walker_command)
            .demandCommand()
    }
}
