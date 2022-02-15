import os
from pathlib import Path
import subprocess
import json
import base58

# PATHS

TAPESTRY_ROOT = Path(os.environ["TAPESTRY_ROOT"])

TARGET_DIR = TAPESTRY_ROOT / "target" 
KEYS_DIR = TAPESTRY_ROOT / "keys"

def get_pubkey_b58(keypath) -> str:
    with open(keypath) as f:
        keypair_numbers: list[int] = json.load(f)
        bytes_arr = bytes()
        for idx in range(32, 64):
            bytes_arr += keypair_numbers[idx].to_bytes(1, "little")
        return base58.b58encode(bytes_arr).decode('utf-8')

    return None

def prompt_yes_or_no(question):
    while "the answer is invalid":
        reply = str(input(question + " (y/n): ")).lower().strip()
        if reply[0] == "y":
            return True
        if reply[0] == "n":
            return False


# HELPERS

def run_command(args, cwd=TAPESTRY_ROOT):
    full_command = " ".join(map(lambda v: str(v), args))
    print(f"Running Command: {full_command}")
    subprocess.check_call(full_command, cwd=cwd, shell=True)