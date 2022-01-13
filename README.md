# Solana Tapestry
The Solana Tapestry Project Repo

# Environment Setup
1. Install Rust from https://rustup.rs/
2. Install Solana v1.9.X or later from https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool
3. Install Node
4. Install NPM, Yarn

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

## app/src/tapestry-client

Wrapper for helping with serializing and deserializing state and communicating with the on chain program and the solana blockchain, Ideally this would be it's wn separate module with its own integration tests.
