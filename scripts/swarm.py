import argparse
import math
from pathlib import Path
import os
from random import random
import subprocess
from helpers import KEYS_DIR, run_command, TAPESTRY_ROOT


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--walkers", type=int, help="Number of walkers to run")
    parser.add_argument("--colors", type=int, default=256)

    args = parser.parse_args()

    procs = []

    for i in range(0, args.walkers):
        keyname = f"walker{i}"
        keypath = KEYS_DIR / f"{keyname}.json"
        if not keypath.exists():
            run_command(
                ["solana-keygen", "new", "-o", keypath, "--no-bip39-passphrase"]
            )

        run_command(["solana", "airdrop", "1000", keypath])

        random_x = math.floor(random() * 1000)
        random_y = math.floor(random() * 1000)
        command = [
            "pla",
            "tx",
            "walker",
            "-x",
            random_x,
            "-y",
            random_y,
            "--keyname",
            keyname,
            "--colors",
            args.colors,
        ]
        command = map(lambda v: str(v), command)
        proc = subprocess.Popen(
            command, cwd=TAPESTRY_ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        procs.append(proc)

    for proc in procs:
        proc.wait()


if __name__ == "__main__":
    main()
