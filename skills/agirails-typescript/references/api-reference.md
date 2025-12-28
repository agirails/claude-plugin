# TypeScript SDK API Reference

## ACTPClient

### `ACTPClient.create(options)`

Factory method to create a client instance.

```typescript
interface CreateOptions {
  mode: 'mock' | 'testnet' | 'mainnet';
  privateKey?: string;        // Required for testnet/mainnet
  requesterAddress?: string;  // Required for mock mode
  rpcUrl?: string;            // Optional, has defaults
  stateDirectory?: string;    // Mock mode state persistence
}

const client = await ACTPClient.create({
  mode: 'mock',
  requesterAddress: '0x...',
});
```

### Properties

```typescript
client.basic      // Basic API instance
client.standard   // Standard API instance
client.advanced   // Advanced API instance
client.mock       // Mock utilities (only in mock mode)
```

---

## Basic API

### `client.basic.pay(options)`

Create and fund a transaction in one call.

```typescript
interface PayOptions {
  to: string;                  // Provider address (checksummed)
  amount: string;              // Amount in USDC (e.g., '100.00')
  deadline?: string;           // '+1h', '+24h', '+7d', or Unix timestamp
  disputeWindow?: number;      // Seconds (default: 172800 = 48h)
  serviceDescription?: string; // Optional metadata
}

interface PayResult {
  txId: string;        // Transaction ID (bytes32)
  state: string;       // 'COMMITTED'
  amount: string;      // Formatted amount with decimals
  fee: string;         // Platform fee
  deadline: Date;      // Deadline as Date object
  disputeWindowEnd: Date; // When dispute window closes
}

const result = await client.basic.pay({
  to: '0x...',
  amount: '100.00',
  deadline: '+24h',
});
```

### `client.basic.checkStatus(txId)`

Get transaction status with action hints.

```typescript
interface StatusResult {
  txId: string;
  state: TransactionState;
  stateCode: number;
  amount: string;
  fee: string;
  requester: string;
  provider: string;
  deadline: Date;
  disputeWindowEnd: Date | null;

  // Action hints
  canRelease: boolean;
  canDispute: boolean;
  canCancel: boolean;
  isTerminal: boolean;

  // Formatted time remaining
  timeToDeadline: string | null;
  timeToAutoSettle: string | null;
}

const status = await client.basic.checkStatus('0x...');
```

### `client.basic.release(txId)`

Release escrowed funds to provider.

```typescript
await client.basic.release('0x...');
// Throws NotAuthorizedError if not requester
// Throws InvalidStateTransitionError if not DELIVERED
```

### `client.basic.dispute(txId, options)`

Raise a dispute on a delivered transaction.

```typescript
interface DisputeOptions {
  reason: string;        // Required
  evidenceUrl?: string;  // IPFS URL or other evidence
  evidenceHash?: string; // SHA256 hash of evidence
}

await client.basic.dispute('0x...', {
  reason: 'Service not delivered as specified',
  evidenceUrl: 'ipfs://Qm...',
});
```

### `client.basic.cancel(txId)`

Cancel a transaction before DELIVERED state.

```typescript
await client.basic.cancel('0x...');
// Refunds escrowed amount if any
```

### `client.basic.getBalance(address?)`

Get USDC balance.

```typescript
const myBalance = await client.basic.getBalance();
const otherBalance = await client.basic.getBalance('0x...');
// Returns formatted string: '1234.56'
```

---

## Standard API

### `client.standard.createTransaction(options)`

Create transaction without funding.

```typescript
import { parseUnits } from 'ethers';

interface CreateTransactionOptions {
  provider: string;
  amount: bigint;          // USDC base units (6 decimals)
  deadline: number;        // Unix timestamp
  disputeWindow: number;   // Seconds
  metadata?: string;
}

const tx = await client.standard.createTransaction({
  provider: '0x...',
  amount: parseUnits('100', 6),
  deadline: Math.floor(Date.now() / 1000) + 86400,
  disputeWindow: 172800,
});
// tx.state === 'INITIATED'
```

### `client.standard.linkEscrow(txId)`

Lock funds in escrow.

```typescript
// Approve USDC first
await client.standard.approveUSDC(amount);
// Then link
await client.standard.linkEscrow('0x...');
// State transitions to COMMITTED
```

### `client.standard.transitionState(txId, state, metadata?)`

Transition to new state.

```typescript
type TargetState = 'QUOTED' | 'IN_PROGRESS' | 'DELIVERED';

interface DeliveryMetadata {
  resultHash?: string;  // SHA256 of result
  resultUrl?: string;   // IPFS or URL
}

// Provider delivers
await client.standard.transitionState('0x...', 'DELIVERED', {
  resultHash: '0x...',
  resultUrl: 'ipfs://...',
});
```

### `client.standard.getTransaction(txId)`

Get full transaction details.

```typescript
interface Transaction {
  txId: string;
  requester: string;
  provider: string;
  amount: bigint;
  fee: bigint;
  state: TransactionState;
  stateCode: number;
  deadline: number;
  disputeWindow: number;
  createdAt: number;
  committedAt: number | null;
  deliveredAt: number | null;
  settledAt: number | null;
  resultHash: string | null;
  resultUrl: string | null;
}

const tx = await client.standard.getTransaction('0x...');
```

### `client.standard.getTransactions(filter)`

Query multiple transactions.

```typescript
interface TransactionFilter {
  requester?: string;
  provider?: string;
  participant?: string;  // Either requester or provider
  states?: TransactionState[];
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

const transactions = await client.standard.getTransactions({
  participant: myAddress,
  states: ['COMMITTED', 'DELIVERED'],
  limit: 100,
});
```

### `client.standard.on(event, handler)`

Subscribe to events.

```typescript
type EventName =
  | 'TransactionCreated'
  | 'StateChanged'
  | 'EscrowLinked'
  | 'DisputeRaised'
  | 'DisputeResolved';

interface StateChangedEvent {
  txId: string;
  oldState: TransactionState;
  newState: TransactionState;
  timestamp: number;
  actor: string;
}

client.standard.on('StateChanged', (event: StateChangedEvent) => {
  console.log(`${event.txId}: ${event.oldState} → ${event.newState}`);
});

// Remove listener
client.standard.off('StateChanged', handler);
```

---

## Advanced API

### `client.advanced.kernel`

Direct access to ACTPKernel contract (ethers.js Contract instance).

```typescript
const kernel = client.advanced.kernel;

// Read state
const tx = await kernel.getTransaction('0x...');
const fee = await kernel.platformFeeBps();

// Write (requires signer)
const txResponse = await kernel.createTransaction(...);
await txResponse.wait();

// Query events
const filter = kernel.filters.StateChanged('0x...');
const events = await kernel.queryFilter(filter, fromBlock, toBlock);
```

### `client.advanced.escrow`

Direct access to EscrowVault contract.

```typescript
const escrow = client.advanced.escrow;
const balance = await escrow.getBalance('0x...');
```

### `client.advanced.usdc`

Direct access to USDC contract.

```typescript
const usdc = client.advanced.usdc;
const allowance = await usdc.allowance(owner, spender);
await usdc.approve(spender, amount);
```

---

## Mock Utilities

Only available in mock mode.

### `client.mock.mint(address, amount)`

Mint test USDC.

```typescript
await client.mock.mint('0x...', 10000);
// Address now has 10000 USDC
```

### `client.mock.advanceTime(seconds)`

Fast-forward time.

```typescript
await client.mock.advanceTime(3600); // 1 hour
await client.mock.advanceTime(86400); // 1 day
```

### `client.mock.reset()`

Clear all mock state.

```typescript
await client.mock.reset();
// All transactions and balances cleared
```

### `client.mock.setBalance(address, amount)`

Set exact balance.

```typescript
await client.mock.setBalance('0x...', 500);
```

---

## Types

```typescript
type TransactionState =
  | 'INITIATED'
  | 'QUOTED'
  | 'COMMITTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'SETTLED'
  | 'DISPUTED'
  | 'CANCELLED';

type Mode = 'mock' | 'testnet' | 'mainnet';
```
