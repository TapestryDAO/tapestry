import argparse


from helpers import TARGET_DIR, KEYS_DIR, TAPESTRY_ROOT, run_command, get_pubkey_b58

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dest", type=str, choices=["localhost", "devnet"], default="localhost")
    parser.add_argument("--upgrade", action="store_true", default=False)
    parser.add_argument("--airdrop", action="store_true", default=False)
    args = parser.parse_args()

    program_id_keypath = KEYS_DIR / "program_ids" / f"{args.dest}.json"
    program_id_pubkey = get_pubkey_b58(program_id_keypath)
    program_auth_keypath = KEYS_DIR / "program_auths" / f"{args.dest}.json"
    program_auth_pubkey = get_pubkey_b58(program_auth_keypath)

    success = False
    try:
        # Aidrop sol if needed
        if args.airdrop:
            airdrop_cmd = ["solana", "airdrop", "--url", args.dest, "10", program_auth_pubkey]
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

    

if __name__ == "__main__":
    main()
