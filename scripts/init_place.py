import argparse
import subprocess

from helpers import KEYS_DIR, get_pubkey_b58, TAPESTRY_ROOT, run_command, check_balance

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", help="keyname that will be the owner",type=str, required=True)
    parser.add_argument("--network", choices=["devnet", "localhost"], required=True)
    args = parser.parse_args()

    owner_keypath = KEYS_DIR / f"{args.owner}.json"
    owner_pubkey = get_pubkey_b58(owner_keypath)
    network = args.network
    
    required_balance_for_init = 25 # guess
    while check_balance(network, owner_keypath) < required_balance_for_init:
        airdrop_cmd = ["solana", "airdrop", 3, "--url", network, "--keypair", owner_keypath]
        run_command(airdrop_cmd)

    starting_balance = check_balance(network, owner_keypath)

    print(f"{owner_pubkey} - now has {starting_balance} SOL on {network}")

    # Initialize the place state and set to defaults
    run_command([
        "pla", "tx", "update_place",
        "--keyname", args.owner,
    ])

    run_command([
        "pla", "tx", "initmint",
        "--keyname", args.owner,
    ])

    # Initialize all patch data
    run_command([
        "pla", "tx", "initpatches", 
        "--keyname", args.owner, 
    ])

    final_balance = check_balance(network, owner_keypath)
    print(f"{owner_pubkey} - now has {final_balance} SOL on {network}")
    print(f"Total cost was", starting_balance - final_balance, " SOL")



if __name__ == "__main__":
    main()