import { ArgumentsCamelCase, Argv } from "yargs";
import { applyKeynameOption, KeynameOptionArgs } from "../../cli_utils/commandHelpers";
import { loadKey } from "../../cli_utils/utils";
import { PlaceClient } from "../client/src/PlaceClient";

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
        client.setCurrentUser(keypair.publicKey);

        client.OnGameplayTokenRecordsUpdated.addMemo((records) => {
            if (records === null) {
                console.log("Got null records");
                client.kill();
                return;
            }

            for (const record of records) {
                console.log("---- ");
                console.log("Gpt meta pubkey   : ", record.gameplayTokenMetaAcct.pubkey.toBase58());
                console.log("Token Acct Pubkey : ", record.userTokenAccount.pubkey.toBase58());
                console.log("Balance           : ", record.userTokenAccount.data.amount.toString()); // should always be 1
                console.log(
                    "Rand Seed         : ",
                    record.gameplayTokenMetaAcct.data.random_seed.toString()
                );
                console.log(
                    "Update Slot       : ",
                    record.gameplayTokenMetaAcct.data.update_allowed_slot.toString()
                );
                console.log(
                    "Claimable Tokes   : ",
                    record.gameplayTokenMetaAcct.data.place_tokens_owed
                );
            }
            client.kill();
        });
    },
};

const get_state_command = {
    command: "state",
    description: "Get the current Place State account and print contents",
    handler: async (args: ArgumentsCamelCase) => {
        let client = PlaceClient.getInstance();
        let state = await client.fetchPlaceStateAccount();
        console.log("Place State:");
        console.log("AcctType     :", state.acct_type);
        console.log("Owner        :", state.owner.toBase58());
        console.log("Frozen?      :", state.is_frozen);
        console.log("Pbrush price :", state.paintbrush_price.toNumber());
        console.log("Pbrush cool  :", state.paintbrush_cooldown.toNumber());
        console.log("Bomb price   :", state.bomb_price.toNumber());
        client.kill();
    },
};

export const command = {
    command: "get",
    description: "get various state for the place program",
    builder: (argv: Argv) => {
        return argv.command(get_gameplay_tokens_command).command(get_state_command).demandCommand();
    },
};
