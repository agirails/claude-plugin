---
description: This skill provides TypeScript SDK reference for AGIRAILS when the user is working with TypeScript, Node.js, package.json, npm, @agirails/sdk, or asks about TypeScript-specific implementation details. Use this skill when writing TypeScript code that integrates with ACTP.
---

# AGIRAILS TypeScript SDK

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

## Quick Start

```typescript
import { ACTPClient } from '@agirails/sdk';

// Create client in mock mode
const client = await ACTPClient.create({
  mode: 'mock',
  requesterAddress: '0x1234567890123456789012345678901234567890',
});

// Create a payment
const result = await client.basic.pay({
  to: '0xProviderAddress',
  amount: '100.00',
  deadline: '+24h',
});

console.log('Transaction ID:', result.txId);
console.log('State:', result.state);
```

## Client Initialization

### Mock Mode (Development)

```typescript
const client = await ACTPClient.create({
  mode: 'mock',
  requesterAddress: '0x...', // Your address
  stateDirectory: '.actp',   // Optional, for persistence
});
```

### Testnet Mode

```typescript
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.PRIVATE_KEY,
  requesterAddress: process.env.REQUESTER_ADDRESS!,
  rpcUrl: 'https://sepolia.base.org', // Optional, has default
});
```

### Mainnet Mode

```typescript
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey: process.env.PRIVATE_KEY,
  requesterAddress: process.env.REQUESTER_ADDRESS!,
  rpcUrl: process.env.BASE_RPC_URL,
});
```

## Basic API Examples

### Pay for a Service

```typescript
const result = await client.basic.pay({
  to: '0xProviderAddress',
  amount: '100.00',            // String, in USDC
  deadline: '+24h',            // Relative or absolute
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
  } else {
    throw error;
  }
}
```

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

## CLI Commands

The SDK includes CLI tools:

```bash
# Check balance
npx actp balance

# Mint test USDC (mock mode only)
npx actp mint 0xAddress 1000

# List transactions
npx actp tx list

# Get transaction status
npx actp tx status 0xTxId

# Watch transaction
npx actp tx watch 0xTxId
```

## Decentralized Identifiers (DIDs)

Every Ethereum address automatically IS a DID - no registration required:

```
did:ethr:84532:0x742d35cc6634c0532925a3b844bc9e7595f0beb
       ↑      ↑
   chainId  address
```

### Basic DID Operations

```typescript
import { DIDResolver } from '@agirails/sdk';

// Build DID from address
const did = DIDResolver.buildDID('0x742d35cc...', 84532);

// Parse DID
const parsed = DIDResolver.parseDID(did);
console.log(parsed.chainId);  // 84532
console.log(parsed.address);  // '0x742d35cc...'

// Resolve to DID Document
const resolver = await DIDResolver.create({ network: 'base-sepolia' });
const result = await resolver.resolve(did);

// Verify signature
const isValid = await resolver.verifySignature(
  did,
  'Hello',
  '0x...',
  { chainId: 84532 }
);
```

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

For detailed API reference, see `references/api-reference.md`.
For error handling patterns, see `references/error-handling.md`.
For migration from v1, see `references/migration-v1-v2.md`.
