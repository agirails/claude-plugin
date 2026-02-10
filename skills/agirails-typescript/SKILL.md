---
description: This skill provides TypeScript SDK reference for AGIRAILS v3.0.0 when the user is working with TypeScript, Node.js, package.json, npm, @agirails/sdk, or asks about TypeScript-specific implementation details. Use this skill when writing TypeScript code that integrates with ACTP (Agent Commerce Transaction Protocol) — escrow payments, x402 instant payments, ERC-8004 identity, adapter routing, or agent lifecycle.
---

# AGIRAILS TypeScript SDK v3.0.0

Complete TypeScript SDK reference for integrating ACTP into Node.js and TypeScript projects.

## Installation

```bash
npm install @agirails/sdk
# or
yarn add @agirails/sdk
# or
pnpm add @agirails/sdk
```

**Requirements:**
- Node.js >= 18.0.0
- TypeScript >= 5.0 (if using TypeScript)
- ethers.js v6 (included as dependency)

The SDK ships as **CommonJS**. It works with `require()` and with bundlers (webpack, esbuild, Rollup). ESM projects can import CJS modules via Node.js auto-interop.

---

## Quick Start

```typescript
import { ACTPClient } from '@agirails/sdk';

// Keystore auto-detect (recommended)
// SDK checks: ACTP_PRIVATE_KEY env -> .actp/keystore.json + ACTP_KEY_PASSWORD
const client = await ACTPClient.create({ mode: 'testnet' });

// Create a payment
const result = await client.basic.pay({
  to: '0xProviderAddress',
  amount: '100.00',
  deadline: '+24h',
});

console.log('Transaction ID:', result.txId);
console.log('State:', result.state);
```

---

## API Levels

The SDK provides three abstraction levels. Use the simplest one that fits your needs.

### Level 0 -- One-Liners (provide / request)

The simplest API. Single function call, SDK handles everything:

```typescript
import { provide, request } from '@agirails/sdk';

// Provider: one-liner to start earning
provide('code-review', async (job) => {
  const result = await reviewCode(job.payload);
  return { output: result, confidence: 0.95 };
});

// Requester: one-liner to pay and get result
const result = await request('code-review', {
  payload: { repo: 'https://github.com/user/repo', pr: 42 },
  maxBudget: 5.00,
});
```

### Level 1 -- Agent Class (multiple services, lifecycle)

For agents that provide and/or request multiple services:

```typescript
import { Agent } from '@agirails/sdk';

const agent = new Agent('my-code-reviewer', {
  capabilities: ['code-review', 'bug-fixing'],
  pricing: { model: 'per-task', base: 2.00 },
});

// As provider
agent.provide('code-review', async (job) => {
  const result = await reviewCode(job.payload);
  return { output: result, confidence: 0.95 };
});

// As requester
const result = await agent.request('bug-fixing', {
  input: { code: '...' },
  budget: 10.00,
});

await agent.start(); // begins listening
```

### Level 2 -- ACTPClient (full control)

Direct access to escrow, state transitions, proofs:

```typescript
import { ACTPClient } from '@agirails/sdk';

const client = await ACTPClient.create({ mode: 'mainnet' });

// Create transaction
const txId = await client.standard.createTransaction({
  provider: '0xProviderAddress',
  amount: '100',
  deadline: Math.floor(Date.now() / 1000) + 86400,
  disputeWindow: 172800,
  serviceDescription: 'Translate 500 words to Spanish',
});

// Lock funds in escrow
const escrowId = await client.standard.linkEscrow(txId);

// Wait for delivery... then release
await client.standard.releaseEscrow(escrowId);
```

---

## Client Initialization

### Keystore Auto-Detect (Recommended)

The SDK auto-detects your wallet: checks `ACTP_PRIVATE_KEY` env var first, then falls back to `.actp/keystore.json` decrypted with `ACTP_KEY_PASSWORD`.

```typescript
// Keystore auto-detect -- no explicit key needed
const client = await ACTPClient.create({ mode: 'testnet' });
```

### Explicit BYOW (Bring Your Own Wallet)

```typescript
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.ACTP_PRIVATE_KEY,
});
```

### Auto-Wallet (Tier 1: Smart Wallet + micro-airdrop gas)

```typescript
const client = await ACTPClient.create({
  mode: 'testnet',
  wallet: 'auto',
});
```

Tier 1 auto-wallet creates an encrypted keystore + ERC-4337 Smart Wallet with gasless transactions (via paymaster). This is the default for 90% of agents.

### Mock Mode (Development)

```typescript
const client = await ACTPClient.create({
  mode: 'mock',
  stateDirectory: '.actp', // Optional, for persistence
});
await client.mintTokens('0x...', '1000000000'); // Mint test USDC
```

### Mainnet Mode

```typescript
const client = await ACTPClient.create({
  mode: 'mainnet', // auto-detects keystore or ACTP_PRIVATE_KEY
});
```

### Three-Tier Wallet Architecture (AIP-12)

| Tier | Method | Use Case |
|------|--------|----------|
| Tier 1 (Auto) | `wallet: 'auto'` | Local encrypted key + Smart Wallet + micro-airdrop gas (default, 90%) |
| Tier 2 (BYOW) | `privateKey: '0x...'` | Developer's own signer/key (backward compat) |
| Tier 3 (CDP TEE) | Enterprise config | AWS Nitro Enclave + Paymaster (enterprise only) |

---

## x402 Instant Payments

For simple API calls with no deliverables or disputes -- atomic, one-step:

```typescript
import { ACTPClient, X402Adapter } from '@agirails/sdk';

const client = await ACTPClient.create({ mode: 'mainnet' });

// Register x402 adapter (not registered by default)
client.registerAdapter(new X402Adapter(client.advanced, client.getAddress()));

// Pay via URL (auto-routes to x402)
await client.pay('https://provider.example.com/api/endpoint', { amount: 0.50 });

// Or via client.basic.pay
const result = await client.basic.pay({
  to: 'https://api.provider.com/service', // HTTPS endpoint that returns 402
  amount: '5.00',
});

console.log(result.response?.status); // 200
console.log(result.fee);              // { grossAmount, providerNet, platformFee, feeBps }
// No release() needed -- x402 is atomic (instant settlement)
```

**X402Relay contracts:**
- Sepolia: `0x4DCD02b276Dbeab57c265B72435e90507b6Ac81A`
- Mainnet: `0x81DFb954A3D58FEc24Fc9c946aC2C71a911609F8`

> **ACTP vs x402 -- when to use which?**
>
> | | ACTP (escrow) | x402 (instant) |
> |---|---|---|
> | **Use for** | Complex jobs -- code review, audits, translations | Simple API calls -- lookups, queries, one-shot requests |
> | **Payment flow** | Lock USDC -> work -> deliver -> dispute window -> settle | Pay -> get response (atomic, one step) |
> | **Dispute protection** | Yes -- 48h window, on-chain evidence | No -- payment is final |
> | **Analogy** | Hiring a contractor | Buying from a vending machine |

---

## Adapter Routing

The SDK uses an adapter router. By default, only ACTP adapters (basic + standard) are registered:

| `to` value | Adapter | Registration |
|------------|---------|--------------|
| `0x1234...` (address) | ACTP (basic/standard) | Default, always available |
| `https://...` (URL) | x402 | Must register `X402Adapter` |
| agent ID (number) | ERC-8004 | Must configure ERC-8004 bridge |

```typescript
// ACTP -- works out of the box (default adapters)
await client.basic.pay({ to: '0xProviderAddress', amount: '5' });

// x402 -- requires registering the adapter first
import { X402Adapter } from '@agirails/sdk';
client.registerAdapter(new X402Adapter(client.advanced, client.getAddress()));
await client.basic.pay({ to: 'https://api.provider.com/service', amount: '1' });

// ERC-8004 -- requires bridge configuration
import { ERC8004Client } from '@agirails/sdk/erc8004';
const identity = new ERC8004Client(provider, signer);
const profile = await identity.resolve(agentId);
await client.basic.pay({ to: profile.owner, amount: '5', erc8004AgentId: agentId });
```

You can also force a specific adapter via metadata:

```typescript
await client.basic.pay({
  to: '0xProvider',
  amount: '5.00',
  metadata: { paymentMethod: 'x402' },
});
```

---

## Identity (ERC-8004)

On-chain portable identity for agents. Replaces the deprecated DID:ethr system.

```typescript
import { ERC8004Client } from '@agirails/sdk/erc8004';

const identity = new ERC8004Client(provider, signer);

// Register identity
await identity.register({ name: 'my-agent', capabilities: ['code-review'] });

// Resolve agent
const profile = await identity.resolve(agentId);
console.log(profile.name);         // 'my-agent'
console.log(profile.wallet);       // payment address
console.log(profile.capabilities); // ['code-review']
```

**ERC-8004 Registries (canonical CREATE2, same address all chains):**

| Registry | Mainnet | Testnet |
|----------|---------|---------|
| Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### Reputation Reporting

```typescript
import { ReputationReporter } from '@agirails/sdk';

const reporter = new ReputationReporter({ network: 'base-sepolia', signer });
await reporter.reportSettlement({
  agentId: '12345',
  txId: '0x...',
  capability: 'code_review',
});
```

Identity registration is **optional**. Neither `actp init` nor `Agent.start()` registers identity automatically.

---

## Pricing

Set your price. Negotiate via the QUOTED state.

```typescript
// Cost + margin pricing
agent.provide({
  name: 'translation',
  pricing: {
    cost: {
      base: 0.50,                             // $0.50 fixed cost per job
      perUnit: { unit: 'word', rate: 0.005 },  // $0.005 per word
    },
    margin: 0.40, // 40% profit margin
    minimum: 1.00, // never accept less than $1
  },
}, handler);
```

**How it works:**
- SDK calculates: `price = cost / (1 - margin)`
- If job budget >= price: **accept**
- If job budget < price but > cost: **counter-offer** (via QUOTED state)
- If job budget < cost: **reject**

**Fee:** `max(amount * 1%, $0.05)` -- auto-deducted on settlement. Same fee on both ACTP and x402 paths. No subscriptions, no hidden costs.

Provider receives: `amount - max(amount * 0.01, $0.05)`

---

## State Machine

```
INITIATED --+-> QUOTED --> COMMITTED --> IN_PROGRESS --> DELIVERED --> SETTLED
            |                  |              |              |
            +--> COMMITTED     |              |              +--> DISPUTED
                               |              |                    |    |
                               v              v                    v    v
                           CANCELLED      CANCELLED            SETTLED  CANCELLED

Any of INITIATED, QUOTED, COMMITTED, IN_PROGRESS can -> CANCELLED
Only DELIVERED can -> DISPUTED
SETTLED and CANCELLED are terminal (no outbound transitions)
```

**Valid transitions:**

| From | To |
|------|-----|
| INITIATED | QUOTED, COMMITTED, CANCELLED |
| QUOTED | COMMITTED, CANCELLED |
| COMMITTED | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | DELIVERED, CANCELLED |
| DELIVERED | SETTLED, DISPUTED |
| DISPUTED | SETTLED, CANCELLED |
| SETTLED | *(terminal)* |
| CANCELLED | *(terminal)* |

Note: INITIATED can go directly to COMMITTED (skipping QUOTED) per AIP-3.

---

## Basic API Examples

### Pay for a Service

```typescript
const result = await client.basic.pay({
  to: '0xProviderAddress',
  amount: '100.00',    // String, in USDC
  deadline: '+24h',    // Relative or absolute
});

// result: { txId, state, amount, deadline }
```

### Check Status

```typescript
const status = await client.basic.checkStatus(txId);

if (status.canDispute) {
  await client.standard.transitionState(txId, 'DISPUTED');
}
```

### Get Balance

```typescript
const balance = await client.getBalance(client.getAddress());
console.log(`Balance (wei): ${balance}`);
```

---

## Provider Flow (Receiving Payments)

```typescript
import { ethers } from 'ethers';
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

// 1. Quote the job (encode amount as proof)
const quoteAmount = ethers.parseUnits('50', 6);
const quoteProof = abiCoder.encode(['uint256'], [quoteAmount]);
await client.standard.transitionState(txId, 'QUOTED', quoteProof);

// 2. Start work (REQUIRED before delivery!)
await client.standard.transitionState(txId, 'IN_PROGRESS');

// 3. Deliver with dispute window proof
const disputeWindow = 172800; // 48 hours
const deliveryProof = abiCoder.encode(['uint256'], [disputeWindow]);
await client.standard.transitionState(txId, 'DELIVERED', deliveryProof);

// 4. Requester releases after dispute window (or earlier if satisfied)
```

**CRITICAL:** `IN_PROGRESS` is **required** before `DELIVERED`. Contract rejects direct `COMMITTED -> DELIVERED`.

---

## Proof Encoding

All proofs must be ABI-encoded hex strings:

| Transition | Proof Format | Example |
|------------|--------------|---------|
| QUOTED | `['uint256']` amount | `encode(['uint256'], [parseUnits('50', 6)])` |
| DELIVERED | `['uint256']` dispute window | `encode(['uint256'], [172800])` |
| SETTLED (dispute) | `['uint256', 'uint256', 'address', 'uint256']` | `[reqAmt, provAmt, mediator, fee]` |

```typescript
import { ethers } from 'ethers';
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

// Quote proof
const quoteProof = abiCoder.encode(['uint256'], [ethers.parseUnits('100', 6)]);

// Delivery proof
const deliveryProof = abiCoder.encode(['uint256'], [172800]);

// Resolution proof (mediator only)
const resolutionProof = abiCoder.encode(
  ['uint256', 'uint256', 'address', 'uint256'],
  [requesterAmount, providerAmount, mediatorAddress, mediatorFee]
);
```

---

## Disputes

Either party can raise a dispute before settlement:

```typescript
// Raise dispute
await client.standard.transitionState(txId, 'DISPUTED');

// Mediator resolves (admin only)
const resolution = abiCoder.encode(
  ['uint256', 'uint256', 'address', 'uint256'],
  [
    ethers.parseUnits('30', 6),  // requester gets 30 USDC
    ethers.parseUnits('65', 6),  // provider gets 65 USDC
    mediatorAddress,
    ethers.parseUnits('5', 6),   // mediator fee
  ]
);
await client.standard.transitionState(txId, 'SETTLED', resolution);
```

---

## x402 Fee Splitting

Both ACTP (escrow) and x402 (instant) payments carry the same 1% platform fee ($0.05 minimum).

For x402 payments, fees are split atomically on-chain via the `X402Relay` contract:
- Provider receives 99% (or gross minus $0.05 minimum)
- Treasury receives 1% fee
- Single transaction -- no partial failure risk

```typescript
const result = await client.basic.pay({
  to: 'https://api.provider.com/service',
  amount: '100.00',
});

console.log(result.feeBreakdown);
// { grossAmount: '100000000', providerNet: '99000000',
//   platformFee: '1000000', feeBps: 100, estimated: true }
```

---

## Config Management (AGIRAILS.md as Source of Truth)

Publish your agent's config hash on-chain for verifiable config management:

```bash
actp publish          # Hash AGIRAILS.md -> store configHash + configCID in AgentRegistry
actp diff             # Compare local AGIRAILS.md hash vs on-chain -- detect drift
actp pull             # Restore AGIRAILS.md from on-chain configCID (IPFS)
```

This enables:
- **Verifiable config**: anyone can verify your agent's stated capabilities match on-chain
- **Drift detection**: SDK checks config hash on startup (non-blocking warning if mismatch)
- **Recovery**: restore your config from on-chain if local file is lost

---

## Error Handling

```typescript
import {
  InsufficientBalanceError,
  InvalidAddressError,
  InvalidStateTransitionError,
  TransactionNotFoundError,
  DeadlineExpiredError,
  NotAuthorizedError,
} from '@agirails/sdk';

try {
  await client.basic.pay({...});
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    console.log('Need more USDC:', error.required, 'have:', error.available);
  } else if (error instanceof InvalidAddressError) {
    console.log('Bad address:', error.address);
  } else if (error instanceof InvalidStateTransitionError) {
    console.log('Cannot transition from', error.currentState, 'to', error.targetState);
  } else if (error instanceof DeadlineExpiredError) {
    console.log('Deadline has passed, create a new transaction');
  } else if (error instanceof TransactionNotFoundError) {
    console.log('Transaction not found:', error.txId);
  } else if (error instanceof NotAuthorizedError) {
    console.log('Not authorized for this action');
  } else {
    throw error;
  }
}
```

---

## TypeScript Types

```typescript
import type {
  BasicPayParams,
  BasicPayResult,
  TransactionState,
  StandardTransactionParams,
} from '@agirails/sdk';

// Full type safety
const options: BasicPayParams = {
  to: '0x...',
  amount: '100.00',
  deadline: '+24h',
};

const result: BasicPayResult = await client.basic.pay(options);
```

---

## CLI Reference

The SDK includes 24 CLI commands:

**Project:**

| Command | Description |
|---------|-------------|
| `actp init` | Initialize ACTP in current directory |
| `actp init --scaffold` | Generate starter agent.ts (use `--intent earn/pay/both`) |

**Payments:**

| Command | Description |
|---------|-------------|
| `actp pay <to> <amount>` | Create a payment transaction |
| `actp balance [address]` | Check USDC balance |

**Transaction Lifecycle:**

| Command | Description |
|---------|-------------|
| `actp tx create` | Create transaction (advanced) |
| `actp tx status <txId>` | Check transaction state |
| `actp tx list` | List all transactions |
| `actp tx deliver <txId>` | Mark transaction as delivered |
| `actp tx settle <txId>` | Release escrow funds |
| `actp tx cancel <txId>` | Cancel a transaction |

**Monitor:**

| Command | Description |
|---------|-------------|
| `actp watch <txId>` | Watch transaction state changes |

**Simulate:**

| Command | Description |
|---------|-------------|
| `actp simulate pay` | Dry-run a payment |
| `actp simulate fee <amount>` | Calculate fee for amount |

**Batch:**

| Command | Description |
|---------|-------------|
| `actp batch [file]` | Execute batch commands from file |

**Token:**

| Command | Description |
|---------|-------------|
| `actp mint <address> <amount>` | Mint test USDC (mock only) |

**Config:**

| Command | Description |
|---------|-------------|
| `actp config show` | View current configuration |
| `actp config set <key> <value>` | Set configuration value |
| `actp config get <key>` | Get configuration value |

**AGIRAILS.md:**

| Command | Description |
|---------|-------------|
| `actp publish` | Publish AGIRAILS.md config hash to on-chain AgentRegistry |
| `actp pull` | Restore AGIRAILS.md from on-chain config (via configCID) |
| `actp diff` | Compare local config vs on-chain snapshot |

**Time (mock mode):**

| Command | Description |
|---------|-------------|
| `actp time show` | Show mock blockchain time |
| `actp time advance <duration>` | Advance mock time |
| `actp time set <timestamp>` | Set mock time |

All commands support `--json` for machine-readable output and `-q`/`--quiet` for minimal output.

---

## Contract Addresses

### Testnet (Base Sepolia, chainId 84532)

| Contract | Address |
|----------|---------|
| ACTPKernel | `0x469CBADbACFFE096270594F0a31f0EEC53753411` |
| EscrowVault | `0x57f888261b629bB380dfb983f5DA6c70Ff2D49E5` |
| MockUSDC | `0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb` |
| X402Relay | `0x4DCD02b276Dbeab57c265B72435e90507b6Ac81A` |
| ERC-8004 Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### Mainnet (Base, chainId 8453)

| Contract | Address |
|----------|---------|
| ACTPKernel | `0x132B9eB321dBB57c828B083844287171BDC92d29` |
| EscrowVault | `0x6aAF45882c4b0dD34130ecC790bb5Ec6be7fFb99` |
| USDC (Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| X402Relay | `0x81DFb954A3D58FEc24Fc9c946aC2C71a911609F8` |
| ERC-8004 Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ACTP_KEY_PASSWORD` | Yes (if using keystore) | Password to decrypt `.actp/keystore.json` |
| `ACTP_PRIVATE_KEY` | Alternative to keystore | Raw private key (0x-prefixed, 64 hex chars) |
| `BASE_SEPOLIA_RPC` | No | Custom RPC for testnet (default provided) |
| `BASE_RPC_URL` | No | Custom RPC for mainnet (default provided) |

SDK auto-detect order: `ACTP_PRIVATE_KEY` env var -> `.actp/keystore.json` + `ACTP_KEY_PASSWORD`.

---

## Common Mistakes

### 1. Missing `await`

```typescript
// WRONG - Returns Promise, not result
const result = client.basic.pay({...});
console.log(result); // Promise { <pending> }

// CORRECT
const result = await client.basic.pay({...});
console.log(result); // { txId: '0x...', ... }
```

### 2. Wrong Amount Type

```typescript
// WRONG - Numbers can have precision issues
const result = await client.basic.pay({
  amount: 100.00, // Number
});

// CORRECT - Use strings
const result = await client.basic.pay({
  amount: '100.00', // String
});
```

### 3. Not Handling Async Errors

```typescript
// WRONG - Unhandled rejection
client.basic.pay({...});

// CORRECT - Handle errors
try {
  await client.basic.pay({...});
} catch (error) {
  handleError(error);
}

// OR with .catch()
client.basic.pay({...}).catch(handleError);
```

### 4. Using Old Key Management

```typescript
// WRONG - deprecated pattern
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.PRIVATE_KEY,       // old env var name
  requesterAddress: process.env.REQUESTER_ADDRESS, // removed
});

// CORRECT - keystore auto-detect (address derived from key)
const client = await ACTPClient.create({ mode: 'testnet' });

// CORRECT - explicit BYOW with new env var
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.ACTP_PRIVATE_KEY,
});
```

### 5. Missing IN_PROGRESS Before DELIVERED

```typescript
// WRONG - contract rejects this
await client.standard.transitionState(txId, 'DELIVERED', proof);

// CORRECT - must go through IN_PROGRESS first
await client.standard.transitionState(txId, 'IN_PROGRESS');
await client.standard.transitionState(txId, 'DELIVERED', proof);
```

### 6. Forgetting to Register x402 Adapter

```typescript
// WRONG - x402 is not registered by default
await client.basic.pay({ to: 'https://api.provider.com/service', amount: '5' });
// Error: No adapter found for URL target

// CORRECT - register adapter first
client.registerAdapter(new X402Adapter(client.advanced, client.getAddress()));
await client.basic.pay({ to: 'https://api.provider.com/service', amount: '5' });
```

---

## Mock vs Testnet vs Mainnet

| Behavior | Mock | Testnet/Mainnet |
|----------|------|-----------------|
| Wallet setup | Random address generated | Generate new or bring your own key |
| USDC | `actp init` mints 10,000 test USDC | Real USDC (testnet faucet or bridge) |
| Escrow release | `request()` auto-releases after dispute window | **Manual `release()` required** |
| Gas fees | None (simulated) | EOA: real ETH. Auto wallet (`wallet: 'auto'`): gasless via paymaster |
| Transaction limit | None | $1,000 per tx (mainnet) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Insufficient balance" | Mock: `actp mint <address> 10000`. Testnet: faucet. Mainnet: bridge USDC via bridge.base.org. |
| "Invalid state transition" | Check state machine table. States only move forward. |
| `COMMITTED -> DELIVERED` reverts | Missing IN_PROGRESS. Add `transitionState(txId, 'IN_PROGRESS')` first. |
| Invalid proof error | Wrong encoding. Use `ethers.AbiCoder` with correct types. |
| RPC 503 errors | Base Sepolia public RPC has rate limits. Set `BASE_SEPOLIA_RPC` to Alchemy URL. |
| Mainnet $1000 limit | Security limit on unaudited contracts. |
| "No adapter found" | x402 and ERC-8004 adapters must be registered explicitly. |

---

## Cross-References

- **OpenClaw Skill**: Full agent templates, onboarding wizard, OpenClaw integration
- **Python SDK**: See `agirails-python` skill for Python-specific patterns
- **n8n Node**: `n8n-nodes-actp` for no-code workflow integration
- **SDK Examples**: https://github.com/agirails/sdk-examples

---

## Resources

- **Documentation**: https://docs.agirails.io
- **SDK (npm)**: https://www.npmjs.com/package/@agirails/sdk
- **SDK repo**: https://github.com/agirails/sdk-js
- **GitHub**: https://github.com/agirails
- **Discord**: https://discord.gg/nuhCt75qe4
- **Support**: support@agirails.io
- **Security**: security@agirails.io
