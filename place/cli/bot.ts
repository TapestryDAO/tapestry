// import { sendAndConfirmTransaction, Transaction, ConfirmOptions, PublicKey } from '@solana/web3.js';
// import { inspect } from 'util';
// import { ArgumentsCamelCase, Argv } from 'yargs';
// import { applyKeynameOption, applyProgramOption, applyXYArgOptions, KeynameOptionArgs, ProgramOptionArgs } from '../../cli_utils/commandHelpers';
// import { getNewConnection, loadKey, makeJSONRPC, SOLANA_MAINNET_ENDPOINT } from '../../cli_utils/utils';
// import { PlaceProgram, SetPixelParams, PLACE_HEIGHT_PX, PLACE_WIDTH_PX, PATCH_SIZE_PX } from '../client/src/PlaceProgram';
// import { PlaceClient } from '../client/src/PlaceClient';
// import BN from 'bn.js';
// import { GameplayTokenType } from '../client/src/accounts';
// // @ts-ignore
// import asyncPool from "tiny-async-pool"
// import { GameplayTokenMetaAccount } from '../client/src/accounts/GameplayTokenMetaAccount';
// import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
// import { PLACE_ENDPOINT } from '../client/src';
// import { argv } from 'process';

// type DrawSpiralCommandArgs =
//     KeynameOptionArgs &
//     ProgramOptionArgs;

// const spiral_bot = {
//     command: "spiral",
//     description: "Draw a spiral starting at 0,0 and going out",
//     builder: (args: Argv): Argv<DrawSpiralCommandArgs> => {
//         return applyKeynameOption(applyProgramOption(args))
//     },
//     handler: async (args: ArgumentsCamelCase<DrawSpiralCommandArgs>) => {

//     },
// }


// export const command = {
//     command: "bot",
//     description: "bot commands",
//     builder: (argv: Argv) => {
//         return argv
//             .command(spiral_bot)
//     }
// }
