import argparse
from pathlib import Path
import os
import subprocess
import sys
from time import sleep
import math

import argparse

TAPESTRY_ROOT = Path(os.environ["TAPESTRY_ROOT"])

KEYS_DIR = TAPESTRY_ROOT / "keys"

# Expects array of any
def run_command(args, cwd=TAPESTRY_ROOT):
    full_command = " ".join(map(lambda v: str(v), args))
    print(f"Running Command: {full_command}")
    subprocess.check_call(full_command, cwd=TAPESTRY_ROOT, shell=True)


def fill_pattern(x: int, y: int, width: int, height: int, pattern: str, keyname: str):
        run_command(["tap", "tx", "fillpattern",
            "-x", x,
            "-y", y, 
            "--width", width, 
            "--height", height, 
            "--pattern", f"tapestry/res/patterns/{pattern}/", 
            "--keyname", keyname
            ])

def set_featured(x: int, y: int, width: int, height: int, callout: str, sol_domain: str, keyname: str):
    run_command(["tap", "tx", "pushfeat",
        "-x", x,
        "-y", y,
        "--width", width,
        "--height", height,
        "--keyname", keyname,
        "--callout", f"\"{callout}\"",
        "--sol_domain", sol_domain,
    ])

def create_key_if_needed(keyname: str):
    keypath = KEYS_DIR / f"{keyname}.json"
    if not keypath.exists():
        print(f"Creating Key {keyname}")
        run_command(["solana-keygen", "new", "-o", keypath, "--no-bip39-passphrase"])
    

def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("--place", action="store_true", default=False)
    parser.add_argument("--tapestry", action="store_true", default=False)

    args = parser.parse_args()

    print("Checking Keys")

    default_keys = [
        "owner",
        "buyer",
        "player1",
        "player2",
        "player3",
    ]

    for key in default_keys:
        create_key_if_needed(key)

    run_command(["yarn", "rust:build"])

    print("Starting and resetting local validator")
    process = subprocess.Popen(["yarn", "localnet:up", "--reset"], cwd=TAPESTRY_ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    print(f"Waiting for validator: {process.pid}")
    sleep(5)

    print("Airdroping SOL")
    for key in default_keys:
        run_command(["tap", "tx", "airdrop", "--keyname", key, "--amount", "1000"])

    if args.tapestry:
        print("Initializing Tapestry State")
        run_command(["tap", "tx", "init", "--keyname", "owner"])

        print("Purchasing initial patches")
        fill_pattern(0, 0, 8, 13, "vango", "buyer")
        fill_pattern(-8, -8, 8, 8, "chunk_border", "buyer")
        fill_pattern(20, 20, 4, 5, "dino", "buyer")
        fill_pattern(-16, -8, 8, 8, "checker", "buyer")
        fill_pattern(100, 100, 8, 6, "greece", "buyer")
        fill_pattern(504, 504, 8, 8, "chunk_border", "buyer")

        print("Setting Featured State")
        set_featured(100, 100, 8, 6, "Greece!", "willyb.sol", "owner")
        set_featured(504, 504, 8, 8, "Yo Check out 512, 512!", "someoneelse.sol", "owner")

    patch_size = 20
    if args.place:
        print("Setting Initial pixels")

        # Initialize the place state and set to defaults
        run_command([
            "pla", "tx", "update_place",
            "--keyname", "owner",
        ])

        run_command([
            "pla", "tx", "initmint",
            "--keyname", "owner",
        ])

        # Initialize all patch data
        run_command([
            "pla", "tx", "initpatches", 
            "--keyname", "owner", 
        ])
                
    
    # Kill the locally running validator
    process.kill()
    process.wait()

if __name__ == "__main__":
    main()