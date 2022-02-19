from git import *
import os
from pathlib import Path
import subprocess
import shutil
import argparse

TAPESTRY_ROOT = Path(os.environ.get("TAPESTRY_ROOT"))
MPL_URL = "https://github.com/metaplex-foundation/metaplex-program-library.git"
MPL_TAG = "@metaplex-foundation/mpl-token-vault@0.1.0"

BUILD_DIR = TAPESTRY_ROOT / "build" / "custom_deps"

MPL_ROOT = BUILD_DIR / "mpl-program-library"
MPL_TARGET_DIR = MPL_ROOT / "target"
MPL_OUT_DIR = MPL_TARGET_DIR / "deploy"
MPL_PROGRAMS = ["mpl_token_metadata"]

CARGO_DEPLOY_DIR = TAPESTRY_ROOT / "target" / "deploy"

# NOTE(will): this exists to allow me to run rust integration tests against
# the mpl library, I feel like there must be a better way to do this, but I haven't found it
# and no one on the metaplex discord has responded to me :(

# TODO(will): I think it might be best to clone this repo and depend on it
# but actually load SO's from mainnet via `solana program dump`,
# this way, the localnet set up will reflect what to actually expect on chain
def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("--clean", action="store_true")

    args = parser.parse_args()

    MPL_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        Repo.clone_from(MPL_URL, MPL_ROOT)
    except:
        print("Already Cloned repo probably")

    repo = Repo(MPL_ROOT)
    repo.git.checkout(MPL_TAG)

    if args.clean:
        MPL_TARGET_DIR.rmdir()

    stamp_path = MPL_TARGET_DIR / f"{repo.head.commit}.stamp"

    if not stamp_path.exists():
        command = ["cargo", "build-bpf"]
        subprocess.check_call(" ".join(command), cwd=MPL_ROOT, shell=True)

        for program in MPL_PROGRAMS:
            src_so = program + ".so"
            src_key = program + "-keypair.json"
            shutil.copy(MPL_OUT_DIR / src_so, CARGO_DEPLOY_DIR)
            shutil.copy(MPL_OUT_DIR / src_key, CARGO_DEPLOY_DIR)

        stamp_path.touch()


if __name__ == "__main__":
    main()
