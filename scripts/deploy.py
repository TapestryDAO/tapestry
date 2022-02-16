import argparse
import semver

from helpers import TARGET_DIR, KEYS_DIR, TAPESTRY_ROOT, check_balance, prompt_yes_or_no, run_command, get_pubkey_b58

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", type=str, choices=["localhost", "devnet"], default="localhost")
    args = parser.parse_args()

    program_id_keypath = KEYS_DIR / "program_ids" / f"{args.dest}.json"
    program_id_pubkey = get_pubkey_b58(program_id_keypath)
    program_auth_keypath = KEYS_DIR / "program_auths" / f"{args.dest}.json"
    program_auth_pubkey = get_pubkey_b58(program_auth_keypath)
    starting_balance = check_balance(args.dest, program_auth_keypath)

    print("Deploying:")
    print("Desination         : ", args.dest)
    print("Program ID         : ", program_id_pubkey)
    print("Program Authority  : ", program_auth_pubkey)
    print("Auth Acct. Balance : ", starting_balance, " SOL")

    result = prompt_yes_or_no("Would you like to continue deployment?")

    if not result:
        raise Exception("user did not want to continue")

    success = False
    try:
        # Aidrop sol if needed
        required_balance_for_deploy = 6 # guess
        while check_balance(args.dest, program_auth_keypath) < required_balance_for_deploy:
            airdrop_cmd = ["solana", "airdrop", "--url", args.dest, "3", program_auth_pubkey]
            run_command(airdrop_cmd)

        # fresh build injecting program ID
        env_stuff = [f"SOLANA_PLACE_PROGRAM_ID=\"{program_id_pubkey}\""]
        build_cmd = ["cargo", "build-bpf"]
        bpf_out_dir = TAPESTRY_ROOT / "target" / args.dest
        if args.dest == "devnet":
            build_cmd += ["--features", "devnet"]
            
        build_cmd += ["--bpf-out-dir", bpf_out_dir]

        run_command(env_stuff + build_cmd)

        # Deploy to dest
        deploy_cmd = ["solana", "program", "deploy", bpf_out_dir / "solana_place.so"]
        deploy_cmd += ["--program-id", program_id_keypath]
        deploy_cmd += ["--keypair", program_auth_keypath]
        deploy_cmd += ["--url", args.dest]
        deploy_cmd += ["--output", "json-compact"]

        run_command(deploy_cmd)

        success = True
    except Exception as e:
        print(f"Caught error: {e}")
        success = False

    final_balance = check_balance(args.dest, program_auth_keypath)
    if success:
        print("Deployed Succesfully")
        print("Final Auth Acct. Balance : ", final_balance, " SOL")
        print("Total Deploy Cost        : ", starting_balance - final_balance, " SOL")
    

    

if __name__ == "__main__":
    main()
