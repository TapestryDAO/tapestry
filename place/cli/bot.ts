import { Transaction } from "@solana/web3.js";
import { ArgumentsCamelCase, Argv } from "yargs";
import {
    applyKeynameOption,
    applyProgramOptions,
    applyXYArgOptions,
    KeynameOptionArgs,
    ProgramOptionArgs,
    XYOptionArgs,
} from "../../cli_utils/commandHelpers";
import { loadKey } from "../../cli_utils/utils";
import { PLACE_HEIGHT_PX, PLACE_WIDTH_PX } from "../client/src/PlaceProgram";
import { PlaceClient } from "../client/src/PlaceClient";
import { GameplayTokenType } from "../client/src/accounts";
import { findEndpoints, findProgramVersion } from "../client/src";

type DrawSpiralCommandArgs = KeynameOptionArgs &
    ProgramOptionArgs &
    XYOptionArgs & { num_tokens: number };

const spiral_bot = {
    command: "spiral",
    description: "Draw a spiral starting at 0,0 and going out",
    builder: (args: Argv): Argv<DrawSpiralCommandArgs> => {
        let args1 = applyKeynameOption(args);
        let args2 = applyProgramOptions(args1);
        let args3 = applyXYArgOptions(args2, PLACE_WIDTH_PX / 2, PLACE_HEIGHT_PX / 2);
        return args3.option("num_tokens", {
            description: "Number of tokens to use, will purchase them if needed",
            type: "number",
            default: 100,
        });
    },
    handler: async (args: ArgumentsCamelCase<DrawSpiralCommandArgs>) => {
        let programVersion = findProgramVersion(args.network, args.program_id);
        let endpoint = findEndpoints(args.network);
        let client = PlaceClient.getInstanceInit(programVersion, endpoint);

        let userKeypair = loadKey(args.keyname);
        client.setCurrentUser(userKeypair.publicKey);

        let tokens = await client.fetchGptRecords(userKeypair.publicKey);
        console.log(userKeypair.publicKey.toBase58() + " had " + tokens.length + " tokens");

        // purchase some tokens
        for (let i = 0; i < args.num_tokens - tokens.length; i++) {
            let state = await client.fetchPlaceStateAccount();
            let ix = await client.placeProgram.purchaseGameplayToken({
                payer: userKeypair.publicKey,
                token_type: GameplayTokenType.PaintBrush,
                desired_price: state.paintbrush_price,
            });
            let tx = new Transaction().add(ix);
            let signature = await client.connection.sendTransaction(tx, [userKeypair]);
            console.log("purchased token ", signature);
            let result = await client.connection.confirmTransaction(signature, "processed");
        }

        let tokensAfterPurchase = await client.fetchGptRecords(userKeypair.publicKey);
        if (tokensAfterPurchase.length < args.num_tokens) {
            console.warn(
                "Number of Gameplay tokens looks incorrect, maybe some failed to purchase"
            );
            console.warn("Got: ", tokensAfterPurchase.length, " expected: ", args.num_tokens);
        }

        let currentX = args.x;
        let currentY = args.y;
        let currentLegProgress = 0;
        let directionDistances = [0, 0, 0, 0];
        let directions = [
            { x: 1, y: 0 }, // right
            { x: 0, y: 1 }, // up
            { x: -1, y: 0 }, // left
            { x: 0, y: -1 }, // down
        ];
        let currentDirectionIdx = 0;
        let currentToken = 0;

        let currentColor = 0;
        let maxColor = 31; // (avoid white)

        let paintbrushCooldown = 10 * 60 * 1000;
        let interval = paintbrushCooldown / tokensAfterPurchase.length;

        let tokensSorted = client.getCurrentUserGptRecordsSorted() ?? [];

        setInterval(async () => {
            let token = tokensSorted[currentToken];
            currentToken = (currentToken + 1) % tokensSorted.length;

            let pixelParams = {
                x: currentX,
                y: currentY,
                pixel: currentColor + 1,
                payer: userKeypair.publicKey,
                gameplay_token_meta_acct: token.gameplayTokenMetaAcct.pubkey,
                gameplay_token_acct: token.userTokenAccount.pubkey,
            };

            currentColor = (currentColor + 1) % maxColor;

            let ix = await client.placeProgram.setPixel(pixelParams);
            let tx = new Transaction().add(ix);
            let sig = await client.connection.sendTransaction(tx, [userKeypair]);
            let result = await client.connection.confirmTransaction(sig, "recent");
            console.log("set pixel (" + currentX + ",", +currentY + ") - ", sig, "\n", result);

            currentLegProgress += 1;

            let oppositeDirectionIdx = (currentDirectionIdx + 2) % 4;

            let oppositeLegProgress = directionDistances[oppositeDirectionIdx];

            if (currentLegProgress > oppositeLegProgress) {
                // update the distance for current direction
                directionDistances[currentDirectionIdx] = currentLegProgress;
                // change direction
                currentDirectionIdx = (currentDirectionIdx + 1) % directions.length;
                currentLegProgress = 0;
            }

            currentX = directions[currentDirectionIdx].x + currentX;
            currentY = directions[currentDirectionIdx].y + currentY;
        }, interval);
    },
};

export const command = {
    command: "bot",
    description: "bot commands",
    builder: (argv: Argv) => {
        return argv.command(spiral_bot);
    },
};
