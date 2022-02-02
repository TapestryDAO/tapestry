# Solana Tapestry
The Solana Tapestry Project Repo

# Environment Setup
1. Install Rust from https://rustup.rs/
2. Install Solana v1.8.12  using `sh -c "$(curl -sSfL https://release.solana.com/v1.8.12/install)"` for linux
or see https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool for other platforms
3. Install Node
4. Install NPM, Yarn
5. add TAPESTRY_ROOT to your environment and path (NOTE: this is should be set to the root of the repo, not the tapestry directory within the repo)
```
# in ~/.bashrc

export TAPESTRY_ROOT="/home/bizzle/solproj/soltapestry"
export PATH="$TAPESTRY_ROOT:$PATH"
```
6. run `yarn setup` from tapestry root


# Quickstart
Start the test validator
```bash
yarn localnet:up
```

Start the App
```bash
yarn app:start
```

Build rust program code
```bash
yarn program:build
```

Test rust program code (no need to start the test validator)
```bash
yarn pogram:test
```

# Directory structure

## program

Solana program 

## app

Tapestry React App

## client

Wrapper for helping with serializing and deserializing state and communicating with the on chain program and the solana blockchain, Ideally this would be it's wn separate module with its own integration tests.

## commands

CLI commands to interact with the tapestry and show state
