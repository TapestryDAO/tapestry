import os
from pathlib import Path
import subprocess
import shutil
import argparse

TAPESTRY_ROOT = Path(os.environ.get("TAPESTRY_ROOT"))
MPL_URL = "https://github.com/metaplex-foundation/metaplex-program-library.git"
MPL_TAG = "@metaplex-foundation/mpl-metaplex@0.0.2"

CARGO_DEPLOY_DIR = TAPESTRY_ROOT / "target" / "deploy"
MPL_DEPLOY_DIR = TAPESTRY_ROOT / "build" / "custom_deps" / "mpl-program-library" / "target" / "deploy"

PROGRAMS = [
    ("Tapestry11111111111111111111111111111111111", CARGO_DEPLOY_DIR / "solana_tapestry.so"),
    ("tapestry11111111111111111111111111111111111", CARGO_DEPLOY_DIR / "solana_place.so"),
    ("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s", MPL_DEPLOY_DIR / "mpl_token_metadata.so "),
    ("auctxRXPeJoc4817jDhf4HbjnhEcr1cCXenosMhK5R8", MPL_DEPLOY_DIR / "mpl_auction.so"),
    ("hausS13jsjafwWwGqZTUQRmWyvyxn9EQpqMwV1PBBmk", MPL_DEPLOY_DIR / "mpl_auction_house.so"),
    ("vau1zxA2LbssAUEF7Gpw91zMM1LvXrvpzJtmZ58rPsn", MPL_DEPLOY_DIR / "mpl_token_vault.so"),
]

# NOTE(will): as far as I can tell, you can only load programs to the test validator on boot
# which seems really dumb, but I can't get `solana program deploy` to work with a running validator
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", default=False)

    args = parser.parse_args()

    command = ["solana-test-validator"]

    for prog_tup in PROGRAMS:
        command += ["--bpf-program", prog_tup[0], prog_tup[1]]

    if args.reset:
        command += ["--reset"]

    command_str = " ".join(map(lambda item: str(item), command))

    print("Exec Command: \n", command, "\n\n")
    subprocess.check_call(command_str, shell=True, cwd=TAPESTRY_ROOT)



if __name__ == "__main__":
    main()