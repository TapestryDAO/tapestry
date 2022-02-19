import subprocess
from time import sleep

from helpers import airdrop, run_command, TAPESTRY_ROOT, KEYS_DIR


def create_key_if_needed(keyname: str):
    keypath = KEYS_DIR / f"{keyname}.json"
    if not keypath.exists():
        print(f"Creating Key {keyname}")
        run_command(["solana-keygen", "new", "-o", keypath, "--no-bip39-passphrase"])


def main():

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
    process = subprocess.Popen(
        ["yarn", "localnet:up", "--reset"],
        cwd=TAPESTRY_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    print(f"Waiting for validator: {process.pid}")
    sleep(5)

    print("Airdroping SOL")
    for key in default_keys:
        airdrop(1000, KEYS_DIR / f"{key}.json")

    print("Waiting for airdops to finalize")
    sleep(10)

    print("Setting Initial pixels")

    # Initialize the place state and set to defaults
    run_command(
        [
            "pla",
            "tx",
            "update_place",
            "--keyname",
            "owner",
        ]
    )

    run_command(
        [
            "pla",
            "tx",
            "initmint",
            "--keyname",
            "owner",
        ]
    )

    # Initialize all patch data
    run_command(
        [
            "pla",
            "tx",
            "initpatches",
            "--keyname",
            "owner",
        ]
    )

    # Kill the locally running validator
    process.kill()
    process.wait()


if __name__ == "__main__":
    main()
