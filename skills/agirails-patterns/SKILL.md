---
description: This skill provides guidance on AGIRAILS SDK usage patterns when the user asks about API levels, adapter routing, which API to use, SDK integration patterns, x402 vs ACTP, mock mode, testnet vs mainnet, key management, discovery, config management, or how to structure their ACTP integration. Use this skill when helping users choose the right abstraction level and payment adapter for their use case.
---

# AGIRAILS SDK Patterns (v3.0)

The AGIRAILS SDK provides a multi-level API with intelligent adapter routing. Payments are routed automatically based on the `to` parameter, so you pick the right level of abstraction for your needs and the SDK handles the rest.

## Quickstart (Copy-Paste-Run)

Install and run in 30 seconds — no wallet, no keys, no config:

```bash
npm install @agirails/sdk
```

Save as `quickstart.js` and run with `node quickstart.js`:

```javascript
const { ACTPClient } = require('@agirails/sdk');

async function main() {
  // Create client in mock mode (no blockchain, no keys needed)
  const client = await ACTPClient.create({ mode: 'mock' });
  console.log('Address:', client.getAddress());

  // Mint test USDC (mock only — starts with 0 balance)
  await client.mintTokens(client.getAddress(), '10000000000'); // 10,000 USDC
  const balance = await client.getBalance(client.getAddress());
  console.log('Balance:', balance, 'wei (', Number(balance) / 1e6, 'USDC)');

  // Pay a provider (escrow flow)
  const result = await client.pay({
    to: '0x0000000000000000000000000000000000000001',
    amount: '5.00', // 5 USDC (human-readable, not wei)
  });
  console.log('Payment created:', result.txId);
  console.log('State:', result.state); // COMMITTED
  console.log('Escrow ID:', result.escrowId);
  console.log('Release required:', result.releaseRequired);
}

main().catch(console.error);
```

**Output:**
```
Address: 0x... (random mock address)
Balance: 10000000000 wei ( 10000 USDC)
Payment created: 0x... (transaction hash)
State: COMMITTED
Escrow ID: 0x...
Release required: true
```

**Next steps:** Replace `mock` with `testnet` (add `ACTP_PRIVATE_KEY` env var) or `mainnet` for production.

## Adapter Routing (Most Important Pattern)

The SDK inspects the `to` parameter and routes to the correct payment adapter automatically:

| `to` value | Adapter | Registration | Settlement |
|------------|---------|--------------|------------|
| `0x1234...` (address) | ACTP escrow | Default, always available | Lock / hold / release |
| `https://...` (URL) | x402 instant | Must register `X402Adapter` | Single atomic transfer |
| agent ID (number) | ERC-8004 resolve then ACTP | Must configure ERC-8004 bridge | Lock / hold / release |

```typescript
// ACTP escrow (default) - address detected, routes to ACTP
await client.pay({ to: '0xProviderAddress', amount: 10.00 });

// x402 instant (requires adapter) - URL detected, routes to x402
import { X402Adapter } from '@agirails/sdk';
client.registerAdapter(new X402Adapter(client.getAddress(), {
  expectedNetwork: 'base-sepolia', // or 'base-mainnet'
  // Provide your own USDC transfer function (signer = your ethers.Wallet)
  transferFn: async (to, amount) => {
    const usdc = new ethers.Contract(USDC_ADDRESS, ['function transfer(address,uint256) returns (bool)'], signer);
    return (await usdc.transfer(to, amount)).hash;
  },
}));
await client.pay({ to: 'https://api.example.com/translate', amount: 0.50 });

// ERC-8004 (resolve agent ID to address) - agent ID auto-resolves via registry
await client.pay({ to: '42', amount: 5.00 }); // resolves agent #42 via ERC-8004 registry

// Force adapter via metadata (override auto-detection)
await client.pay({
  to: '0xProvider',
  amount: 10.00,
  metadata: { preferredAdapter: 'x402' }
});
```

## ACTP vs x402 Decision Guide

| Property | ACTP (Escrow) | x402 (Instant) |
|----------|---------------|----------------|
| Use case | Complex jobs, multi-step work | Pay-per-call, API access |
| Payment flow | Lock -> Hold -> Release | Single atomic transfer |
| Dispute resolution | Yes (bilateral + mediator) | No |
| State machine | 8 states | None (instant settlement) |
| Fee | 1% / $0.05 min | 1% / $0.05 min (same) |
| Contract | ACTPKernel + EscrowVault | X402Relay |
| Refunds | Yes (CANCELLED state) | No |
| Delivery proof | On-chain (EAS attestation) | HTTP response body |

**Decision rule:** Use ACTP for jobs > $5 or needing guarantees (escrow, disputes, deadlines). Use x402 for API calls < $5 where instant settlement is preferred.

## Three API Levels

```
+---------------------------------------------------------------+
|                  LEVEL 0 (One-Liners)                         |
|  provide() / request() - Simplest possible interface          |
+---------------------------------------------------------------+
|                  LEVEL 1 (Agent Class)                         |
|  Agent() - Production agents with capabilities & pricing      |
+---------------------------------------------------------------+
|                  LEVEL 2 (ACTPClient)                          |
|  client.basic / client.standard / client.advanced             |
|  Full control over every step                                 |
+---------------------------------------------------------------+
```

### Level 0: One-Liners (Simplest)

For quick prototyping and simple integrations. One function call does everything.

```typescript
import { provide, request } from '@agirails/sdk';

// Provider: expose a service in 3 lines
provide('code-review', async (job) => {
  const review = await reviewCode(job.input.code);
  return { output: review, confidence: 0.95 };
});

// Requester: buy a service in 1 line
const result = await request('code-review', {
  input: { code: sourceCode },
  budget: 5.00,
});
```

**Best for:** Rapid prototyping, hackathons, simple one-off integrations.

### Level 1: Agent Class (Recommended for Production)

For production agents with multiple capabilities, structured pricing, and lifecycle management.

```typescript
import { Agent } from '@agirails/sdk';

const agent = new Agent({
  name: 'my-agent',
  network: 'testnet',
  behavior: { concurrency: 3 },
});

agent.provide('code-review', async (job) => {
  const review = await reviewCode(job.input.code);
  return { output: review };
});

agent.provide('translation', async (job) => {
  const translated = await translate(job.input.text, job.input.lang);
  return { output: translated };
});

await agent.start(); // begins listening for jobs
```

**Best for:** Production agents, agents offering multiple services, agents that need structured lifecycle.

### Level 2: ACTPClient (Full Control)

For developers who need fine-grained control over every protocol step.

```
+---------------------------------------------------------------+
|                     BASIC API (client.basic)                    |
|  One-liner operations - Auto-handles everything - Best for AI  |
+---------------------------------------------------------------+
|                   STANDARD API (client.standard)                |
|  State management - Explicit lifecycle - Full control          |
+---------------------------------------------------------------+
|                   ADVANCED API (client.advanced)                |
|  Direct contract calls - Custom transactions - Maximum flex    |
+---------------------------------------------------------------+
```

#### Quick Decision Guide (Level 2 Tiers)

| Your Situation | Use This |
|----------------|----------|
| AI agent making payments | Basic API |
| Simple pay/receive flow | Basic API |
| Need transaction monitoring | Advanced API + custom indexer |
| Custom error handling | Standard API |
| Building a dashboard | Standard API |
| Multi-step workflows | Standard API |
| Custom gas strategies | Advanced API |
| Batch transactions | Advanced API |
| Protocol extensions | Advanced API |

#### Basic API (`client.basic`)

Highest-level ACTPClient abstraction. One method call does everything.

**Best for:** AI agents, simple integrations, rapid prototyping, when you don't need fine control.

```typescript
// Pay for a service
const result = await client.basic.pay({
  to: providerAddress,
  amount: '100.00',
  deadline: '+24h',
});

// Check transaction status
const status = await client.basic.checkStatus(txId);
// Returns: { state, canAccept, canComplete, canDispute }
```

**What Basic API handles automatically:**
- Input validation and normalization
- Smart defaults (deadline, dispute window)
- Escrow linking inside `pay()`
- User-friendly output formatting

#### Standard API (`client.standard`)

Mid-level abstraction. More control over individual steps.

**Best for:** Production applications, custom UX flows, explicit lifecycle control.

```typescript
// Create transaction
const txId = await client.standard.createTransaction({
  provider: providerAddress,
  amount: '100',
  deadline: '+24h',
  disputeWindow: 172800,
});

// Link escrow (separate step)
await client.standard.linkEscrow(txId);

// Get full transaction details
const details = await client.standard.getTransaction(txId);

// Transition state (provider) - IN_PROGRESS required before DELIVERED
await client.standard.transitionState(txId, 'IN_PROGRESS');

// DELIVERED requires ABI-encoded dispute window proof
const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const proof = abiCoder.encode(['uint256'], [172800]); // 2 days
await client.standard.transitionState(txId, 'DELIVERED', proof);
```

**When to upgrade from Basic to Standard:**
- You need event listeners
- You want to separate create/fund steps
- You need access to raw transaction data
- You're building a transaction dashboard

#### Advanced API (`client.advanced`)

Lowest-level abstraction. Direct access to contracts.

**Best for:** Protocol developers, custom integrations, batch operations, gas optimization.

```typescript
// Direct contract access
const kernel = client.advanced.kernel;
const escrow = client.advanced.escrow;

// Build custom transactions
const tx = await kernel.populateTransaction.createTransaction(...);
tx.gasLimit = 100000n;
const result = await signer.sendTransaction(tx);

// Batch multiple operations
const batch = client.advanced.createBatch();
batch.add(kernel.createTransaction(...));
batch.add(escrow.linkEscrow(...));
await batch.execute();

// Custom event filtering
const filter = kernel.filters.StateChanged(txId);
const events = await kernel.queryFilter(filter, fromBlock, toBlock);
```

## Key Management

The SDK uses a three-tier wallet architecture. Keystore auto-detect is the default for 90% of users.

### Tier 1: Keystore Auto-Detect (Default, 90% of users)

```typescript
// SDK checks: ACTP_PRIVATE_KEY env -> .actp/keystore.json + ACTP_KEY_PASSWORD
const client = await ACTPClient.create({ mode: 'testnet' });
// That's it. No privateKey, no requesterAddress needed.
```

Resolution order:
1. `ACTP_PRIVATE_KEY` environment variable
2. `.actp/keystore.json` file + `ACTP_KEY_PASSWORD` environment variable

### Tier 2: BYOW (Bring Your Own Wallet)

```typescript
// Developer provides their own signer/key (backward compatible)
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.ACTP_PRIVATE_KEY,
});
```

### Tier 3: Auto-Wallet (Smart Wallet + Paymaster)

```typescript
// Smart Wallet with gas sponsorship via Paymaster (enterprise)
const client = await ACTPClient.create({
  mode: 'testnet',
  wallet: 'auto',
});
```

## Mode Selection

The SDK supports three modes:

| Mode | Purpose | Blockchain | Funds |
|------|---------|------------|-------|
| `mock` | Development & testing | None (in-memory) | Unlimited fake |
| `testnet` | Pre-production testing | Base Sepolia | Test USDC |
| `mainnet` | Production | Base | Real USDC |

### Mock Mode

```typescript
import { IMockRuntime } from '@agirails/sdk';

const client = await ACTPClient.create({ mode: 'mock' });

// Mint unlimited test tokens
// Mint uses USDC wei (6 decimals): 1000 USDC = 1_000_000_000
await client.mintTokens(address, '1000000000');

// Fast-forward time (testing)
await (client.advanced as IMockRuntime).time.advanceTime(3600); // 1 hour
```

**Mock mode features:**
- No blockchain connection needed
- Instant transaction confirmation
- State persists in `.actp/` directory
- Time manipulation for testing
- Perfect for CI/CD

### Testnet Mode

```typescript
const client = await ACTPClient.create({ mode: 'testnet' });
// Keystore auto-detect handles credentials
```

**Testnet requirements:**
- Base Sepolia ETH for gas
- Test USDC tokens
- Wallet key (via keystore or env)

### Mainnet Mode

```typescript
const client = await ACTPClient.create({ mode: 'mainnet' });
```

**Before mainnet:**
- Complete security review
- Test thoroughly on testnet
- Set up monitoring
- Have incident response plan

## Discovery Patterns

How agents find each other and advertise services.

### A2A Agent Card (`/.well-known/agent.json`)

Standardized agent discovery via well-known URL:

```json
{
  "name": "translator-pro",
  "capabilities": ["translation", "summarization"],
  "pricing": { "model": "per-task", "base": 0.50 },
  "actp": {
    "address": "0x...",
    "chain": "base",
    "agentId": 42
  }
}
```

### ServiceDirectory (In-Memory, Per-Process)

For local/testing discovery:

```typescript
import { serviceDirectory } from '@agirails/sdk';

// In-memory, per-process singleton (not persistent)
serviceDirectory.register('translation', { address: '0x...', price: 0.50 });
const providers = serviceDirectory.findProviders('translation');
```

### ERC-8004 Registry Lookup

On-chain agent identity resolution:

```typescript
// Resolve agent ID to address via ERC-8004 bridge (read-only)
import { ERC8004Bridge } from '@agirails/sdk';
const bridge = new ERC8004Bridge({ network: 'base-sepolia' });
const agent = await bridge.resolveAgent('42');
console.log(agent.wallet); // payment address
```

### Job Board (Coming Soon)

Decentralized marketplace for agent services. Agents post available services, requesters browse and select.

## Config Management (AGIRAILS.md as Source of Truth)

Agent configuration lives in `AGIRAILS.md` at the project root. The SDK provides tools to keep on-chain and local config in sync.

### CLI Commands

```bash
# Publish local AGIRAILS.md config to on-chain registry
actp publish

# Pull on-chain config to local AGIRAILS.md
actp pull

# Show diff between local and on-chain config
actp diff
```

### Drift Detection

`ACTPClient.create()` performs a non-blocking drift check on initialization. If local config differs from on-chain, a warning is logged but execution continues.

```typescript
const client = await ACTPClient.create({ mode: 'mainnet' });
// Console warning if drift detected:
// "AGIRAILS.md config hash differs from on-chain. Run `actp diff` to inspect."
```

## Common Patterns

### Pattern: AI Agent Integration (Level 0)

```typescript
import { request } from '@agirails/sdk';

async function getTranslation(text: string, lang: string) {
  const result = await request('translation', {
    input: { text, lang },
    budget: 1.00,
  });
  return result.output;
}
```

### Pattern: Multi-Adapter Agent (Level 1)

```typescript
import { Agent, X402Adapter } from '@agirails/sdk';

const agent = new Agent({
  name: 'research-assistant',
  network: 'testnet',
});

// Register x402 for API calls
agent.registerAdapter(new X402Adapter(agent.getAddress(), {
  expectedNetwork: 'base-sepolia',
  // Provide your own USDC transfer function (signer = your ethers.Wallet)
  transferFn: async (to, amount) => {
    const usdc = new ethers.Contract(USDC_ADDRESS, ['function transfer(address,uint256) returns (bool)'], signer);
    return (await usdc.transfer(to, amount)).hash;
  },
}));

agent.provide('research', async (job) => {
  // Use x402 for cheap API calls
  const data = await agent.pay({
    to: 'https://api.scraper.com/extract',
    amount: 0.10,
  });

  // Use ACTP for expensive sub-tasks
  const analysis = await agent.pay({
    to: '0xAnalystAgent',
    amount: 5.00,
  });

  return { output: analysis.output };
});

await agent.start();
```

### Pattern: Provider Service (Level 2)

```typescript
// Trigger this from your own event monitor (ethers) or polling loop
async function handleJob(txId: string) {
  await processJob(txId);
  await client.standard.transitionState(txId, 'IN_PROGRESS');
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const proof = abiCoder.encode(['uint256'], [172800]);
  await client.standard.transitionState(txId, 'DELIVERED', proof);
}
```

### Pattern: Dashboard/Monitoring (Level 2)

```typescript
// Build a dashboard from your own indexer or on-chain events
// Then hydrate each txId with runtime data as needed.
async function getDashboardRow(txId: string) {
  const tx = await client.standard.getTransaction(txId);
  return {
    id: tx?.id,
    state: tx?.state,
    amountWei: tx?.amount,
    deadline: tx ? new Date(tx.deadline * 1000) : null,
  };
}
```

## Migration Between Levels

You can mix levels as needed. Start simple, upgrade when you need more control:

```typescript
// Start with Level 0
const { result } = await request('translation', { input: { text: 'Hello' }, budget: 1.00 });

// Move to Level 1 for multi-capability agents
const agent = new Agent({ name: 'my-agent', network: 'testnet' });
agent.provide('translation', handler);

// Drop to Level 2 for fine-grained control
const client = await ACTPClient.create({ mode: 'testnet' });
const rawTx = await client.advanced.getTransaction(result.txId);
```

Within Level 2, you can also mix tiers:

```typescript
// Start with Basic
const result = await client.basic.pay({...});

// Access Advanced when needed
const rawTx = await client.advanced.getTransaction(result.txId);
```

## Related Resources

- Agent building guide: See `agirails-agent-building` skill
- Full protocol specification: See `agirails-core` skill
- TypeScript specifics: See `agirails-typescript` skill
- Python SDK: Coming soon (full rewrite in progress)
