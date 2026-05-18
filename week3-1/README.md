# Escrow Program

A simple Solana escrow program built with Anchor.

## Overview

This project implements a basic escrow flow for token exchange between two users.

The escrow program allows a maker to create an offer, deposit tokens into a vault, and then either complete the exchange with a taker or cancel the offer and receive the tokens back.

## Instructions

### `make`

Creates a new escrow offer.

The maker deposits token A into the escrow vault and defines the amount of token B expected in return.

### `take`

Completes the escrow exchange.

The taker sends token B to the maker and receives token A from the escrow vault.

### `refund`

Cancels the escrow offer.

The maker receives the deposited token A back from the vault.

## Tests

The project includes TypeScript integration tests for the main successful scenarios:

- `make`: maker creates escrow and deposits token A into the vault
- `take`: taker accepts escrow and completes the exchange
- `refund`: maker cancels escrow and receives token A back

Test result:

![TypeScript test results](./assets/ts_tests_resutls.png)

## Tech Stack

- Solana
- Anchor
- Rust
- TypeScript
- SPL Token
