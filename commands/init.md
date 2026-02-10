---
description: Initialize AGIRAILS SDK in the current project. Auto-detects language (TypeScript or Python), installs the SDK, creates configuration files, and generates an encrypted keystore.
allowed-tools:
  - Glob
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
argument-hint: "[--lang ts|py] [--version x.x.x] [--scaffold]"
---

# /agirails:init

Set up AGIRAILS SDK in the current project.

## What This Command Does

1. Detect project language (TypeScript/Node.js or Python)
2. Check if SDK is already installed
3. Install the SDK using the appropriate package manager
4. Create configuration directory (`.actp/`)
5. Generate encrypted keystore (`.actp/keystore.json`)
6. Create `.env.example` with required variables
7. Update `.gitignore` to exclude sensitive files
8. Show quickstart code example

## Step-by-Step Instructions

### Step 1: Detect Language

Check for project configuration files:

```
Glob("package.json")     -> TypeScript/Node.js project
Glob("pyproject.toml")   -> Python project (modern)
Glob("requirements.txt") -> Python project (traditional)
```

If multiple found, prefer in order: package.json > pyproject.toml > requirements.txt

If none found, ask the user:
```
"No project configuration found. What language are you using?"
Options: [TypeScript/Node.js] [Python]
```

### Step 2: Check Existing Installation

**TypeScript:**
```bash
# Check if already installed
ls node_modules/@agirails/sdk 2>/dev/null && echo "installed" || echo "not installed"
```

**Python:**
```bash
# Check if already installed
pip show agirails 2>/dev/null && echo "installed" || echo "not installed"
```

If already installed, inform user and ask:
```
"AGIRAILS SDK is already installed (version X.X.X). What would you like to do?"
Options: [Skip installation] [Reinstall] [Upgrade to latest]
```

### Step 3: Detect Package Manager

**TypeScript:**
```
Glob("pnpm-lock.yaml")   -> use pnpm
Glob("yarn.lock")        -> use yarn
Glob("package-lock.json") -> use npm
Default                   -> use npm
```

**Python:**
```
Glob("poetry.lock")      -> use poetry
Glob("uv.lock")          -> use uv
Glob("Pipfile")          -> use pipenv
Default                   -> use pip
```

### Step 4: Install SDK

**TypeScript:**
```bash
# npm
npm install @agirails/sdk

# yarn
yarn add @agirails/sdk

# pnpm
pnpm add @agirails/sdk
```

**Python:**
```bash
# pip
pip install agirails

# poetry
poetry add agirails

# uv
uv add agirails
```

If installation fails, show the error and suggest:
- Check internet connection
- Try manual installation
- Check permissions

### Step 5: Create Configuration and Keystore

Create `.actp/` directory:
```bash
mkdir -p .actp
touch .actp/.gitkeep
```

Generate encrypted keystore:
```bash
# Generate encrypted keystore
actp init
# -> Prompts for password
# -> Creates .actp/keystore.json (encrypted with AES-128-CTR)
# -> Derives address from key
# -> Mints 10,000 MockUSDC in mock mode
```

If `actp` CLI is not available (SDK not globally installed), generate the keystore programmatically or instruct the user to run `npx @agirails/sdk init` instead.

If `--scaffold` flag is provided, create full project scaffold:
```bash
actp init --scaffold
# Creates full project scaffold:
# ├── AGIRAILS.md          <- Agent configuration (source of truth)
# ├── .actp/
# │   ├── keystore.json    <- Encrypted private key
# │   └── .gitkeep
# ├── .env.example
# └── src/
#     └── agent.ts         <- Starter agent code
```

Create `.env.example`:
```env
# AGIRAILS SDK Configuration

# Mode: mock (development), testnet (testing), mainnet (production)
AGIRAILS_MODE=mock

# Key management (choose one):
# Option 1: Keystore (recommended) -- auto-detected from .actp/keystore.json
# ACTP_KEY_PASSWORD=your-password

# Option 2: Explicit key
# ACTP_PRIVATE_KEY=0x...

# RPC URL (optional, has defaults)
# BASE_SEPOLIA_RPC=https://...
# BASE_MAINNET_RPC=https://...
```

### Step 6: Update .gitignore

Check if `.gitignore` exists. If not, create it.

Add these entries if not present:
```gitignore
# AGIRAILS
.actp/
.env
.env.local
.env.*.local
```

### Step 7: Show Quickstart

**TypeScript:**
```typescript
import { ACTPClient } from '@agirails/sdk';

async function main() {
  // Create client in mock mode (no blockchain needed)
  // Keystore auto-detected from .actp/keystore.json
  const client = await ACTPClient.create({ mode: 'mock' });

  // Check balance (USDC wei)
  const balance = await client.getBalance(client.getAddress());
  console.log('Balance (wei):', balance);

  // Mint test tokens (mock mode only)
  // Mint uses USDC wei (6 decimals): 1000 USDC = 1_000_000_000
  await client.mintTokens(client.getAddress(), '1000000000');

  // Create a payment
  const result = await client.basic.pay({
    to: '0xProviderAddress',
    amount: '10.00',
    deadline: '+24h',
  });

  console.log('Transaction ID:', result.txId);
}

main().catch(console.error);
```

**Python:**
```python
import asyncio
from agirails import ACTPClient

async def main():
    # Create client in mock mode (no blockchain needed)
    # Keystore auto-detected from .actp/keystore.json
    client = await ACTPClient.create(mode="mock")

    # Check balance
    balance = await client.get_balance()
    print(f"Balance: {balance} USDC")

    # Mint test tokens (mock mode only)
    await client.mint_tokens(client.get_address(), 1000)

    # Create a payment
    result = await client.basic.pay({
        "to": "0xProviderAddress",
        "amount": 10.00,
        "deadline": "24h",
    })

    print(f"Transaction ID: {result.tx_id}")

if __name__ == "__main__":
    asyncio.run(main())
```

### Step 8: Show Next Steps

```
SDK installed successfully!

Next steps:
1. Set ACTP_KEY_PASSWORD in your environment (password used during keystore generation)
2. Try the quickstart code above
3. Run: /agirails:pay to create your first payment
4. Run: /agirails:states to see the state machine

Useful commands:
- actp balance        - Check USDC balance
- actp mint <amount>  - Mint test USDC (mock mode)
- actp tx list        - List transactions
- actp publish        - Publish AGIRAILS.md to on-chain registry
- actp diff           - Compare local AGIRAILS.md with on-chain config

Need help? Ask: "How do I integrate AGIRAILS into my agent?"
```

## Error Handling

| Error | Resolution |
|-------|------------|
| No package manager found | Guide user to install npm/pip |
| Installation fails | Show error, suggest manual install |
| Permission denied | Suggest sudo or fix permissions |
| Network error | Check internet, try again |
| Keystore already exists | Ask user: overwrite, skip, or backup |

## Command Arguments

- `--lang ts` or `--lang py`: Skip language detection
- `--version x.x.x`: Install specific version
- `--scaffold`: Create full project scaffold with AGIRAILS.md and starter code

Example:
```
/agirails:init --lang ts --version 3.0.0
/agirails:init --scaffold
```
