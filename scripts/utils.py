import os
from pathlib import Path
import subprocess

# PATHS

TAPESTRY_ROOT = Path(os.environ["TAPESTRY_ROOT"])

KEYS_DIR = TAPESTRY_ROOT / "keys"

# HELPERS

def run_command(args, cwd=TAPESTRY_ROOT):
    full_command = " ".join(map(lambda v: str(v), args))
    print(f"Running Command: {full_command}")
    subprocess.check_call(full_command, cwd=TAPESTRY_ROOT, shell=True)