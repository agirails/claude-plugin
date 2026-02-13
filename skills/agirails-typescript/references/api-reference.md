# TypeScript SDK API Reference

## ACTPClient

### `ACTPClient.create(config)`

Factory method to create a client instance.

```typescript
interface ACTPClientConfig {
  mode: 'mock' | 'testnet' | 'mainnet';
  privateKey?: string;                // Optional — keystore auto-detect is default
  rpcUrl?: string;                    // Optional, has defaults per network
  stateDirectory?: string;            // Mock mode state persistence (.actp/)
  contracts?: {                       // Contract address overrides
    actpKernel?: string;
    escrowVault?: string;
    usdc?: string;
    agentRegistry?: string;
  };
  gasSettings?: {
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  };
  wallet?: 'auto';                  // Enable Smart Wallet + Paymaster (Tier 1 Auto)
  easConfig?: EASConfig;            // Optional EAS config (testnet/mainnet)
  requireAttestation?: boolean;    // Require attestation on releaseEscrow
}

// Keystore auto-detect: checks ACTP_PRIVATE_KEY env → .actp/keystore.json + ACTP_KEY_PASSWORD
const client = await ACTPClient.create({ mode: 'mock' });
```

### Properties

```typescript
client.basic      // BasicAdapter - simple payment methods
client.standard   // StandardAdapter - explicit lifecycle control
client.advanced   // IACTPRuntime - direct protocol access
client.info       // { mode, address, stateDirectory }
```

### Instance Methods

```typescript
// Get the requester address (normalized to lowercase)
client.getAddress(): string

// Get the current mode
client.getMode(): 'mock' | 'testnet' | 'mainnet'

// Reset mock state (mock mode only)
await client.reset(): Promise<void>

// Mint test USDC (mock mode only)
await client.mintTokens(address: string, amount: string): Promise<void>

// Get USDC balance (mock mode only - uses wei units)
await client.getBalance(address: string): Promise<string>
```

---

## Basic API (`client.basic`)

High-level, opinionated API for simple use cases.

### `client.basic.pay(params)`

Create and fund a transaction in one call. Auto-transitions to COMMITTED.

```typescript
interface BasicPayParams {
  to: string;                  // Provider address
  amount: string | number;     // Amount ("100", "100.50", "100 USDC", "$100")
  deadline?: string | number;  // '+1h', '+24h', '+7d', or Unix timestamp
  disputeWindow?: number;      // Seconds (default: 172800 = 2 days)
}

// client.basic.pay() returns UnifiedPayResult (superset of BasicPayResult)
interface UnifiedPayResult {
  txId: string;              // Transaction ID (bytes32)
  escrowId: string | null;   // Escrow ID — needed for releaseEscrow()
  adapter: string;           // Which adapter handled it ('actp', 'x402')
  state: string;             // 'COMMITTED'
  success: boolean;          // Whether payment initiation succeeded
  amount: string;            // Formatted: "100.00 USDC"
  releaseRequired: boolean;  // Always true for ACTP — must call releaseEscrow()
  response?: Response;       // x402 only: HTTP response
  feeBreakdown?: object;     // x402 only: fee details
  error?: string;            // Error message if failed
}

const result = await client.basic.pay({
  to: '0xProvider...',
  amount: '100.00',
  deadline: '+24h',
});
console.log('Transaction ID:', result.txId);
```

### `client.basic.checkStatus(txId)`

Get transaction status with action hints.

```typescript
interface CheckStatusResult {
  state: string;        // Current state name
  canAccept: boolean;   // Provider can accept (INITIATED, before deadline)
  canComplete: boolean; // Provider can deliver (COMMITTED or IN_PROGRESS)
  canDispute: boolean;  // Can dispute (DELIVERED, within dispute window)
}

const status = await client.basic.checkStatus('0x...');
if (status.canComplete) {
  // Provider can mark as delivered
}
```

---

## Standard API (`client.standard`)

Explicit lifecycle control with more flexibility.

### `client.standard.createTransaction(params)`

Create transaction without funding (INITIATED state).

```typescript
interface StandardTransactionParams {
  provider: string;
  amount: string | number;     // User-friendly format
  deadline?: string | number;  // Defaults to +24h
  disputeWindow?: number;      // Defaults to 172800 (2 days)
  serviceDescription?: string;
  agentId?: string;            // ERC-8004 agent ID (for reputation tracking)
}

const txId = await client.standard.createTransaction({
  provider: '0xProvider...',
  amount: '100',
  deadline: '+7d',
});
// Returns transaction ID, state is INITIATED
```

### `client.standard.linkEscrow(txId)`

Lock funds in escrow. Auto-transitions INITIATED/QUOTED → COMMITTED.

```typescript
const escrowId = await client.standard.linkEscrow('0x...');
// State is now COMMITTED
```

### `client.standard.transitionState(txId, newState)`

Transition to a new state.

```typescript
type TransactionState =
  | 'INITIATED' | 'QUOTED' | 'COMMITTED' | 'IN_PROGRESS'
  | 'DELIVERED' | 'SETTLED' | 'DISPUTED' | 'CANCELLED';

import { ethers } from 'ethers';

// Provider marks work as delivered (IN_PROGRESS required)
await client.standard.transitionState(txId, 'IN_PROGRESS');
const proof = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [172800]);
await client.standard.transitionState(txId, 'DELIVERED', proof);

// Valid transitions:
// INITIATED → QUOTED, COMMITTED, CANCELLED
// QUOTED → COMMITTED, CANCELLED
// COMMITTED → IN_PROGRESS, CANCELLED
// IN_PROGRESS → DELIVERED, CANCELLED (provider only)
// DELIVERED → SETTLED, DISPUTED
// DISPUTED → SETTLED, CANCELLED (admin/pauser)
```

### `client.standard.releaseEscrow(escrowId, attestationParams?)`

Release escrowed funds to provider.

```typescript
// Mock mode - no attestation required
await client.standard.releaseEscrow(escrowId);

// Testnet/Mainnet - attestation REQUIRED
await client.standard.releaseEscrow(escrowId, {
  txId: '0x...',
  attestationUID: '0x...',
});
```

### `client.standard.getEscrowBalance(escrowId)`

Get formatted escrow balance.

```typescript
const balance = await client.standard.getEscrowBalance('0x...');
console.log(balance); // "100.00 USDC"
```

### `client.standard.getTransaction(txId)`

Get full transaction details.

```typescript
const tx = await client.standard.getTransaction('0x...');
// Returns MockTransaction | null
```

---

## Advanced API (`client.advanced`)

Direct access to the underlying runtime (IACTPRuntime).

```typescript
import { ethers } from 'ethers';

// client.advanced is the runtime
const runtime = client.advanced;

// Create transaction with protocol-level params
const txId = await runtime.createTransaction({
  provider: '0x...',
  requester: '0x...',
  amount: '100000000',  // wei (USDC has 6 decimals)
  deadline: 1735574400, // Unix timestamp
  disputeWindow: 172800,
});

// Get transaction
const tx = await runtime.getTransaction(txId);

// State transitions
const proof = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [172800]);
await runtime.transitionState(txId, 'IN_PROGRESS');
await runtime.transitionState(txId, 'DELIVERED', proof);

// Escrow operations
await runtime.linkEscrow(txId, amount);
await runtime.releaseEscrow(escrowId);
const balance = await runtime.getEscrowBalance(escrowId);

// Time interface (mock mode)
const now = runtime.time.now();
```

---

## Level 0 API - Provider/Request Primitives

Simple provide/request interface for service discovery.

```typescript
import { provide, request, serviceDirectory } from '@agirails/sdk';

// Register as a provider — provide(service, handler, options?)
const provider = provide('image-generation', async (job) => {
  const image = await generateImage(job.input.prompt);
  return { image };
});

// Request a service — request(service, options)
const { result, transaction } = await request('image-generation', {
  input: { prompt: 'A sunset over mountains' },
  budget: 15.00,
});
// transaction = { id, provider, amount, fee, duration, proof }
// To release payment: await client.standard.releaseEscrow(transaction.id)

// Query service directory
const providers = serviceDirectory.findProviders('image-generation');
// Returns string[] of provider addresses
```

---

## Level 1 API - Agent Abstraction

Higher-level Agent class for autonomous operation.

```typescript
import { Agent, calculatePrice } from '@agirails/sdk';

// Constructor takes AgentConfig (single object, no services array)
const agent = new Agent({
  name: 'my-image-agent',
  network: 'testnet',
  behavior: { concurrency: 3, autoAccept: true },
});

// Register services AFTER construction via agent.provide()
agent.provide('generate', async (job) => {
  const result = await generateImage(job.input);
  return { image: result };
}, {
  pricing: { base: 5.00, perUnit: 0.10, unit: 'image' },
});

await agent.start();
```

---

## Error Types

### Error Hierarchy

```
ACTPError (base)
├── Transaction Errors
│   ├── InsufficientFundsError
│   ├── TransactionNotFoundError
│   ├── DeadlineExpiredError
│   └── InvalidStateTransitionError
├── Validation Errors
│   ├── ValidationError
│   ├── InvalidAddressError
│   ├── InvalidAmountError
│   ├── InvalidCIDError
│   └── InvalidArweaveTxIdError
├── Network Errors
│   ├── NetworkError
│   ├── TransactionRevertedError
│   └── SignatureVerificationError
├── Storage Errors
│   ├── StorageError
│   ├── UploadTimeoutError
│   ├── DownloadTimeoutError
│   ├── FileSizeLimitExceededError
│   ├── StorageAuthenticationError
│   ├── StorageRateLimitError
│   ├── ContentNotFoundError
│   ├── ArweaveUploadError
│   ├── ArweaveDownloadError
│   ├── ArweaveTimeoutError
│   ├── InsufficientBalanceError (Irys)
│   └── SwapExecutionError
├── Agent/Job Errors
│   ├── NoProviderFoundError
│   ├── TimeoutError
│   ├── ProviderRejectedError
│   ├── DeliveryFailedError
│   ├── DisputeRaisedError
│   ├── ServiceConfigError
│   ├── AgentLifecycleError
│   └── QueryCapExceededError
└── (all inherit code, message, details)
```

### Core Errors

```typescript
import {
  // Base
  ACTPError,                    // Base error class

  // Transaction
  InsufficientFundsError,       // Not enough USDC for payment
  TransactionNotFoundError,     // Transaction ID doesn't exist
  InvalidStateTransitionError,  // Invalid state change attempt
  DeadlineExpiredError,         // Transaction deadline passed

  // Validation
  ValidationError,              // Input validation failed
  InvalidAddressError,          // Bad Ethereum address format
  InvalidAmountError,           // Invalid amount (<=0, wrong format)
  InvalidCIDError,              // Invalid IPFS CID format (extends ValidationError)
  InvalidArweaveTxIdError,      // Bad Arweave transaction ID (extends ValidationError)

  // Network
  NetworkError,                 // RPC/network connection issues
  TransactionRevertedError,     // Blockchain transaction reverted
  SignatureVerificationError,   // Signature doesn't match signer
} from '@agirails/sdk';
```

### Storage Errors (IPFS/Arweave)

```typescript
import {
  StorageError,                 // Base storage error
  UploadTimeoutError,           // Upload timed out
  DownloadTimeoutError,         // Download timed out
  FileSizeLimitExceededError,   // File too large
  StorageAuthenticationError,   // Auth failed (API key, etc.)
  StorageRateLimitError,        // Rate limit hit, retry later
  ContentNotFoundError,         // CID not found on network
  ArweaveUploadError,           // Arweave upload failed
  ArweaveDownloadError,         // Arweave download failed
  ArweaveTimeoutError,          // Arweave operation timeout
  InsufficientBalanceError,     // Not enough Irys balance
  SwapExecutionError,           // Token swap failed
} from '@agirails/sdk';
```

### Agent/Job Errors (Level 0/1 API)

```typescript
import {
  NoProviderFoundError,         // No provider for requested service
  TimeoutError,                 // Operation timed out
  ProviderRejectedError,        // Provider refused the job
  DeliveryFailedError,          // Provider failed to deliver
  DisputeRaisedError,           // Dispute was raised on transaction
  ServiceConfigError,           // Invalid service configuration
  AgentLifecycleError,          // Invalid agent state operation
  QueryCapExceededError,        // Registry too large, use indexer
} from '@agirails/sdk';
```

### Error Handling Example

```typescript
import {
  ACTPError,
  InsufficientFundsError,
  InvalidStateTransitionError,
  NetworkError
} from '@agirails/sdk';

try {
  await client.basic.pay({ to: '0x...', amount: 100 });
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    console.log('Need more USDC:', error.details);
    // { required: '100000000', available: '50000000' }
  } else if (error instanceof InvalidStateTransitionError) {
    console.log('Invalid transition:', error.details);
    // { from: 'SETTLED', to: 'DELIVERED', validTransitions: [] }
  } else if (error instanceof NetworkError) {
    console.log('Network issue:', error.message);
    // Retry with exponential backoff
  } else if (error instanceof ACTPError) {
    console.log(`ACTP Error [${error.code}]:`, error.message);
  }
}
```

### Error Properties

All errors extending `ACTPError` have:

```typescript
interface ACTPError extends Error {
  code: string;       // Machine-readable code (e.g., 'INSUFFICIENT_FUNDS')
  txHash?: string;    // Related transaction hash, if any
  details?: any;      // Additional context object
}
```

---

## Types

```typescript
type TransactionState =
  | 'INITIATED'    // 0 - Created, no escrow
  | 'QUOTED'       // 1 - Provider quoted (optional)
  | 'COMMITTED'    // 2 - Escrow linked, work starts
  | 'IN_PROGRESS'  // 3 - Provider working (required before DELIVERED)
  | 'DELIVERED'    // 4 - Work complete
  | 'SETTLED'      // 5 - Payment released (terminal)
  | 'DISPUTED'     // 6 - Under dispute
  | 'CANCELLED';   // 7 - Cancelled (terminal)

type ACTPClientMode = 'mock' | 'testnet' | 'mainnet';
```
