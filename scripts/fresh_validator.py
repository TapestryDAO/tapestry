import argparse
from asyncio import subprocess
from pathlib import Path
import os
import subprocess
import sys
from time import sleep

TAPESTRY_ROOT = Path(os.environ["TAPESTRY_ROOT"])

KEYS_DIR = TAPESTRY_ROOT / "keys"

# Expects array of any
def run_command(args, cwd=TAPESTRY_ROOT):
    subprocess.check_call(" ".join(map(lambda v: str(v), args)), cwd=TAPESTRY_ROOT, shell=True)


def fill_pattern(xLeft: int, yBot: int, xRight: int, yTop: int, pattern: str, keyname: str):
        run_command(["tap", "tx", "fillpattern",
            "--xLeft", xLeft,
            "--yBot", yBot, 
            "--xRight", xRight, 
            "--yTop", yTop, 
            "--pattern", f"res/patterns/{pattern}/", 
            "--keyname", keyname
            ])
    

def main():

    print("Checking Keys")
    buyer_keypath = KEYS_DIR / "buyer.json"
    if not buyer_keypath.exists():
        run_command(["solana-keygen", "new", "-o", buyer_keypath, "--no-bip39-passphrase"])

    owner_keypath = KEYS_DIR / "owner.json"
    if not owner_keypath.exists():
        run_command(["solana-keygen", "new", "-o", owner_keypath, "--no-bip39-passphrase"])

    run_command(["yarn", "program:build"])

    print("Starting and resetting local validator")
    process = subprocess.Popen(["yarn", "localnet:up", "--reset"], cwd=TAPESTRY_ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    print(f"Waiting for validator: {process.pid}")
    sleep(10)

    print("Airdroping SOL")
    run_command(["tap", "tx", "airdrop", "--keyname", "owner", "--amount", "1000"])
    run_command(["tap", "tx", "airdrop", "--keyname", "buyer", "--amount", "1000"])


    print("Initializing Tapestry State")
    run_command(["tap", "tx", "init", "--keyname", "owner"])
    fill_pattern(0, 0, 20, 20, "hello", "buyer")
    fill_pattern(-8, -8, 0, 0, "chunk_border", "buyer")
    fill_pattern(-8, 0, 0, 8, "checker", "buyer")

    # Kill the locally running validator
    process.kill()

if __name__ == "__main__":
    main()