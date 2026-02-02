---
description: This skill provides guidance on AGIRAILS SDK usage patterns when the user asks about API tiers, which API to use, SDK integration patterns, mock mode, testnet vs mainnet, or how to structure their ACTP integration. Use this skill when helping users choose the right abstraction level for their use case.
---

# AGIRAILS SDK Patterns

The AGIRAILS SDK provides a three-tier API designed for different use cases and skill levels. Choose the right tier based on your needs.

## Three-Tier API Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     BASIC API (client.basic)                     │
│  One-liner operations • Auto-handles everything • Best for AI   │
├─────────────────────────────────────────────────────────────────┤
│                   STANDARD API (client.standard)                 │
│  State management • Explicit lifecycle • Full control           │
├─────────────────────────────────────────────────────────────────┤
│                   ADVANCED API (client.advanced)                 │
│  Direct contract calls • Custom transactions • Maximum flex     │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Decision Guide

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

## Basic API (`client.basic`)

Highest-level abstraction. One method call does everything.

**Best for:**
- AI agents
- Simple integrations
- Rapid prototyping
- When you don't need fine control

**Key Methods:**

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

Use the Standard API for state transitions and escrow release.

**What Basic API handles automatically:**
- Input validation and normalization
- Smart defaults (deadline, dispute window)
- Escrow linking inside `pay()`
- User-friendly output formatting

For detailed API reference, see `references/api-tiers.md`.

## Standard API (`client.standard`)

Mid-level abstraction. More control over individual steps.

**Best for:**
- Production applications
- Custom UX flows
- Explicit lifecycle control

**Key Methods:**

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

// For monitoring, use on-chain events (ethers/web3) or polling.
```

**When to upgrade from Basic to Standard:**
- You need event listeners
- You want to separate create/fund steps
- You need access to raw transaction data
- You're building a transaction dashboard

## Advanced API (`client.advanced`)

Lowest-level abstraction. Direct access to contracts.

**Best for:**
- Protocol developers
- Custom integrations
- Batch operations
- Gas optimization

**Key Methods:**

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

**When to use Advanced API:**
- Building protocol extensions
- Implementing custom gas strategies
- Batch transaction optimization
- Direct EVM interaction needed

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

const client = await ACTPClient.create({
  mode: 'mock',
  requesterAddress: '0x...',
});

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
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.PRIVATE_KEY,
  requesterAddress: process.env.REQUESTER_ADDRESS!,
  rpcUrl: 'https://sepolia.base.org',
});
```

**Testnet requirements:**
- Base Sepolia ETH for gas
- Test USDC tokens
- Wallet with private key

### Mainnet Mode

```typescript
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey: process.env.PRIVATE_KEY,
  requesterAddress: process.env.REQUESTER_ADDRESS!,
  rpcUrl: process.env.BASE_RPC_URL,
});
```

**Before mainnet:**
- Complete security review
- Test thoroughly on testnet
- Set up monitoring
- Have incident response plan

For detailed mode comparison, see `references/mode-selection.md`.

## Common Patterns

### Pattern: AI Agent Integration

```typescript
// Use Basic API - simplest for agents
async function payForService(providerAddress: string, amount: string) {
  const result = await client.basic.pay({
    to: providerAddress,
    amount,
    deadline: '+24h',
  });

  // Wait for delivery and release when ready
  return result.txId;
}
```

### Pattern: Provider Service

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

### Pattern: Dashboard/Monitoring

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

## Migration Between Tiers

You can mix tiers as needed:

```typescript
// Start with Basic
const result = await client.basic.pay({...});

// For monitoring, use on-chain events or polling

// Access Advanced when needed
const rawTx = await client.advanced.getTransaction(result.txId);
```

## Related Resources

- Detailed API comparison: `references/api-tiers.md`
- Mode comparison: `references/mode-selection.md`
- TypeScript specifics: See `agirails-typescript` skill
- Python specifics: See `agirails-python` skill
