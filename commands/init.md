---
description: Initialize AGIRAILS SDK in the current project. Installs the TypeScript SDK, creates configuration files, and generates an encrypted keystore.
allowed-tools:
  - Glob
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
argument-hint: "[--version x.x.x] [--scaffold]"
---

# /agirails:init

Set up AGIRAILS SDK in the current project.

## What This Command Does

1. Check if SDK is already installed
2. Install the SDK using the appropriate package manager
3. Create configuration directory (`.actp/`)
4. Generate encrypted keystore (`.actp/keystore.json`)
5. Create `.env.example` with required variables
6. Update `.gitignore` to exclude sensitive files
7. Show quickstart code example

## Step-by-Step Instructions

### Step 1: Check Existing Installation
```bash
# Check if already installed
ls node_modules/@agirails/sdk 2>/dev/null && echo "installed" || echo "not installed"
```

If already installed, inform user and ask:
```
"AGIRAILS SDK is already installed (version X.X.X). What would you like to do?"
Options: [Skip installation] [Reinstall] [Upgrade to latest]
```

### Step 2: Detect Package Manager
```
Glob("pnpm-lock.yaml")   -> use pnpm
Glob("yarn.lock")        -> use yarn
Glob("package-lock.json") -> use npm
Default                   -> use npm
```

### Step 3: Install SDK
```bash
# npm
npm install @agirails/sdk

# yarn
yarn add @agirails/sdk

# pnpm
pnpm add @agirails/sdk
```

If installation fails, show the error and suggest:
- Check internet connection
- Try manual installation
- Check permissions

### Step 4: Create Configuration and Keystore

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

**CRITICAL: AGIRAILS.md MUST have YAML frontmatter.** The SDK's `parseAgirailsMd()` requires `---` fenced YAML. Generate AGIRAILS.md using this structure:

```markdown
---
protocol: AGIRAILS
version: 1.0.0
spec: ACTP
network: base
currency: USDC
fee: "1% ($0.05 min)"
agent:
  name: {{name}}
  intent: {{intent}}
  network: {{network}}
services:
  - name: {{service_name}}
    type: {{service_type}}
    price: {{price}}
    minBudget: {{min_budget}}
    concurrency: {{concurrency}}
contracts:
  testnet:
    chain: base-sepolia
    chainId: 84532
    kernel: "0x469CBADbACFFE096270594F0a31f0EEC53753411"
    escrow: "0x57f888261b629bB380dfb983f5DA6c70Ff2D49E5"
    usdc: "0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb"
  mainnet:
    chain: base-mainnet
    chainId: 8453
    kernel: "0x132B9eB321dBB57c828B083844287171BDC92d29"
    escrow: "0x6aAF45882c4b0dD34130ecC790bb5Ec6be7fFb99"
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
---

# {{Agent Name}}

> {{Short description}}

(... markdown body with services, payment, usage examples ...)
```

Fill `{{placeholders}}` from user's onboarding answers. See `agirails-agent-building` skill for the full template and the canonical template at `SDK and Runtime/AGIRAILS.md/AGIRAILS.md`.

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

### Step 5: Update .gitignore

Check if `.gitignore` exists. If not, create it.

Add these entries if not present:
```gitignore
# AGIRAILS
.actp/
.env
.env.local
.env.*.local
```

### Step 6: Show Quickstart
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

### Step 7: Show Next Steps

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
| No package manager found | Guide user to install npm |
| Installation fails | Show error, suggest manual install |
| Permission denied | Suggest sudo or fix permissions |
| Network error | Check internet, try again |
| Keystore already exists | Ask user: overwrite, skip, or backup |

## Command Arguments

- `--version x.x.x`: Install specific version
- `--scaffold`: Create full project scaffold with AGIRAILS.md and starter code

Example:
```
/agirails:init --version 3.0.0
/agirails:init --scaffold
```
