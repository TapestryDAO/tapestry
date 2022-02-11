import { sendAndConfirmTransaction, Transaction, ConfirmOptions, PublicKey } from '@solana/web3.js';
import { inspect } from 'util';
import { ArgumentsCamelCase, Argv } from 'yargs';
import { applyKeynameOption, applyXYArgOptions, KeynameOptionArgs, XYOptionArgs } from '../../cli_utils/commandHelpers';
import { getNewConnection, loadKey, makeJSONRPC, SOLANA_MAINNET_ENDPOINT } from '../../cli_utils/utils';
import { PlaceProgram, SetPixelParams, PLACE_HEIGHT_PX, PLACE_WIDTH_PX, PATCH_SIZE_PX } from '../client/src/PlaceProgram';
import { PlaceClient } from '../client/src/PlaceClient';
import BN from 'bn.js';
import { GameplayTokenType } from '../client/src/accounts';
// @ts-ignore
import asyncPool from "tiny-async-pool"

type GetGameplayTokensCommandArgs = KeynameOptionArgs;

const get_gameplay_tokens_command = {
    command: "gameplay_tokens",
    description: "get the gameplay token meta accouns owned by the provided pubkey",
    builder: (args: Argv): Argv<GetGameplayTokensCommandArgs> => {
        return applyKeynameOption(args);
    },
    handler: async (args: ArgumentsCamelCase<GetGameplayTokensCommandArgs>) => {
        let keypair = loadKey(args.keyname);
        let client = PlaceClient.getInstance();
        await client.fetchGameplayTokensForOwner(keypair.publicKey);

        let game_play_token_metas = client.getSortedGameplayTokenResultsForOwner(keypair.publicKey);

        for (const meta of game_play_token_metas) {
            if (meta.gameplayTokenAccount == null) {
                console.log("unexpected null gameplay token meta account");
                continue;
            }
            if (meta.tokenAccount == null) {
                console.log("token account is null");
                continue;
            }
            console.log("---- ")
            console.log("Gpt meta pubkey   : ", meta.gameplayTokenAccount.pubkey.toBase58());
            console.log("Token Acct Pubkey : ", meta.tokenAccount.pubkey.toBase58());
            console.log("Balance           : ", meta.tokenAccount.data.amount.toString()); // should always be 1
            console.log("Rand Seed         : ", meta.gameplayTokenAccount.data.random_seed.toString());
            console.log("Update Slot       : ", meta.gameplayTokenAccount.data.update_allowed_slot.toString());
            console.log("Claimable Tokes   : ", meta.gameplayTokenAccount.data.place_tokens_owed);
        }

        client.kill();
    }
}

const get_state_command = {
    command: "state",
    description: "Get the current Place State account and print contents",
    handler: async (args: ArgumentsCamelCase) => {
        let client = PlaceClient.getInstance();
        let state = await client.fetchPlaceStateAccount();
        console.log("Place State:")
        console.log("AcctType     :", state.acct_type);
        console.log("Owner        :", state.owner.toBase58());
        console.log("Frozen?      :", state.is_frozen);
        console.log("Pbrush price :", state.paintbrush_price.toNumber());
        console.log("Pbrush cool  :", state.paintbrush_cooldown.toNumber());
        console.log("Bomb price   :", state.bomb_price.toNumber());
        client.kill()
    }
}


export const command = {
    command: "get",
    description: "get various state for the place program",
    builder: (argv: Argv) => {
        return argv
            .command(get_gameplay_tokens_command)
            .command(get_state_command)
            .demandCommand()
    }
}