from operator import sub
import random
import requests
import math
import subprocess
from pathlib import Path
import argparse
import time

BASE_DIR = Path("/tmp/image_gen_scratch")


def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("--skip_download", action="store_true")
    parser.add_argument("--bootstrap", type=int, default=8)
    args = parser.parse_args()

    BASE_DIR.mkdir(exist_ok=True)

    bootstrap = args.bootstrap

    image_width = 24 * bootstrap
    image_height = 24 * bootstrap
    image_count = 100

    if not args.skip_download:
        print(f"generating images into {BASE_DIR}")
        for i in range(0, image_count):
            data = requests.get(f"https://picsum.photos/{image_width}/{image_height}")
            with open(BASE_DIR / f"random_{i}.jpeg", "wb") as f:
                f.write(data.content)
                f.close()
    else:
        print("skipping image download, hope you already have them")

    level = int((2048 / bootstrap) / 2)
    print("Merging images into a big ass image")

    GEN_DIR = BASE_DIR / "gen"
    GEN_DIR.mkdir(exist_ok=True)

    first_run = True
    previous_level = image_count
    current_image_dim = image_width
    current_time = time.time_ns()
    while level >= 1:
        new_time = time.time_ns()
        print(f"Elapsed Time: {(new_time - current_time) / 1_000_000_000}")
        current_time = new_time
        print(f"Generating {level} squares")

        if first_run:
            for i in range(0, level):
                random_tl = (
                    BASE_DIR / f"random_{random.randint(0, image_count - 1)}.jpeg"
                )
                random_tr = (
                    BASE_DIR / f"random_{random.randint(0, image_count - 1)}.jpeg"
                )
                random_br = (
                    BASE_DIR / f"random_{random.randint(0, image_count - 1)}.jpeg"
                )
                random_bl = (
                    BASE_DIR / f"random_{random.randint(0, image_count - 1)}.jpeg"
                )

                top = GEN_DIR / f"randomtop_{level}_{i}.jpeg"
                bot = GEN_DIR / f"randombot_{level}_{i}.jpeg"

                out = GEN_DIR / f"random_level_{level}_{i}.jpeg"

                merge_horizontal_command1 = [
                    "vips",
                    "merge",
                    random_bl,
                    random_br,
                    bot,
                    "horizontal",
                    "--",
                    f"-{current_image_dim}",
                    "0",
                ]

                merge_horizontal_command2 = [
                    "vips",
                    "merge",
                    random_tl,
                    random_tr,
                    top,
                    "horizontal",
                    "--",
                    f"-{current_image_dim}",
                    "0",
                ]

                merge_vertical_command = [
                    "vips",
                    "merge",
                    bot,
                    top,
                    out,
                    "vertical",
                    "--",
                    "0",
                    f"-{current_image_dim}",
                ]

                subprocess.check_call(
                    " ".join(map(lambda v: str(v), merge_horizontal_command1)),
                    shell=True,
                )
                subprocess.check_call(
                    " ".join(map(lambda v: str(v), merge_horizontal_command2)),
                    shell=True,
                )
                subprocess.check_call(
                    " ".join(map(lambda v: str(v), merge_vertical_command)), shell=True
                )
        else:
            for i in range(0, level):
                random_tl = (
                    GEN_DIR
                    / f"random_level_{previous_level}_{random.randint(0, previous_level - 1)}.jpeg"
                )
                random_tr = (
                    GEN_DIR
                    / f"random_level_{previous_level}_{random.randint(0, previous_level - 1)}.jpeg"
                )
                random_br = (
                    GEN_DIR
                    / f"random_level_{previous_level}_{random.randint(0, previous_level - 1)}.jpeg"
                )
                random_bl = (
                    GEN_DIR
                    / f"random_level_{previous_level}_{random.randint(0, previous_level - 1)}.jpeg"
                )

                top = GEN_DIR / f"randomtop_{level}_{i}.jpeg"
                bot = GEN_DIR / f"randombot_{level}_{i}.jpeg"

                out = GEN_DIR / f"random_level_{level}_{i}.jpeg"

                merge_horizontal_command1 = [
                    "vips",
                    "merge",
                    random_bl,
                    random_br,
                    bot,
                    "horizontal",
                    "--",
                    f"-{current_image_dim}",
                    "0",
                ]

                merge_horizontal_command2 = [
                    "vips",
                    "merge",
                    random_tl,
                    random_tr,
                    top,
                    "horizontal",
                    "--",
                    f"-{current_image_dim}",
                    "0",
                ]

                merge_vertical_command = [
                    "vips",
                    "merge",
                    bot,
                    top,
                    out,
                    "vertical",
                    "--",
                    "0",
                    f"-{current_image_dim}",
                ]

                subprocess.check_call(
                    " ".join(map(lambda v: str(v), merge_horizontal_command1)),
                    shell=True,
                )
                subprocess.check_call(
                    " ".join(map(lambda v: str(v), merge_horizontal_command2)),
                    shell=True,
                )
                subprocess.check_call(
                    " ".join(map(lambda v: str(v), merge_vertical_command)), shell=True
                )

        print(f"Completing Level {level}")

        # FINALLY
        previous_level = level
        level = math.floor(level / 2)
        current_image_dim = current_image_dim * 2
        first_run = False


if __name__ == "__main__":
    main()
