#!/usr/bin/env bash
# Installs Solidity dependencies. `lib/` is gitignored, so run this after cloning.
set -euo pipefail
cd "$(dirname "$0")"
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
echo "Dependencies installed. Run: forge test --root ."
