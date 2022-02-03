# Solana Tapestry
The Solana Tapestry Project Repo

# Environment Setup
1. Install Rust from https://rustup.rs/
1. Install Solana v1.8.12  using `sh -c "$(curl -sSfL https://release.solana.com/v1.8.12/install)"` for linux
or see https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool for other platforms
1. Install Node
1. Install NPM, Yarn
1. Install [Poetry](https://python-poetry.org/docs/#osx--linux--bashonwindows-install-instructions)
1. add TAPESTRY_ROOT to your environment and path (NOTE: this is should be set to the root of the repo, not the tapestry directory within the repo)
```
# in ~/.bashrc

export TAPESTRY_ROOT="/home/bizzle/solproj/soltapestry"
export PATH="$TAPESTRY_ROOT:$PATH"
```
1. run `poetry shell`
1. run `yarn setup` from tapestry root


# Quickstart
build rust programs

```bash
yarn rust:build
yarn rust:build
```

Reset validator / reload new programs 
```bash
yarn localnet:fresh
```

Start the test validator (does not reset state)
```bash
yarn localnet:up
```

Start the "Place" App
```bash
yarn place:client:build
yarn place:app:start
```

Test rust program code (no need to start the test validator)
```bash
yarn rust:test
```

# Directory structure

## place
The new place idea

## place/app
React app code

## place/client
Typescript client, wraps blockchain interactions / serialization and deserialization

## place/cli
Typescript CLI that uses the `client` to interact with the onchain program type `pla --help` for details

## place/program
Rust program for the "Place" idea

## place/res/palletes
Color palletes, ".hex" files which are apparently just a text file with the RGB color info and /n delimiters

## cli_utils
Some helper function for typescript CLI scripts

## Scripts
python scripts for some automation

## tapestry
The original tapestry idea

