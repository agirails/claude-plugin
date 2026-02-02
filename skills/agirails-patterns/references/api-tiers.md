# API Tiers - Complete Reference

## Tier Comparison Matrix

| Feature | Basic | Standard | Advanced |
|---------|-------|----------|----------|
| **Abstraction** | Highest | Medium | Lowest |
| **Lines of code** | Fewest | Moderate | Most |
| **Auto USDC approval** | Yes | No | No |
| **Auto gas estimation** | Yes | Yes | No |
| **Auto retries** | Yes | No | No |
| **Event listeners** | No | Yes | Yes |
| **Batch operations** | No | No | Yes |
| **Custom gas strategies** | No | No | Yes |
| **Raw contract access** | No | No | Yes |

## Basic API Reference

### `client.basic.pay(options)`

Create and fund a transaction in one call.

```typescript
interface PayOptions {
  to: string;           // Provider address
  amount: string;       // Amount in USDC (e.g., '100.00')
  deadline?: string;    // '+1h', '+24h', '+7d', or timestamp
  disputeWindow?: number; // Seconds (default: 172800 = 48h)
  serviceDescription?: string; // Optional metadata
}

interface PayResult {
  txId: string;         // Transaction ID
  state: string;        // 'COMMITTED'
  amount: string;       // Formatted amount
  fee: string;          // Platform fee
  deadline: Date;       // Deadline as Date
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
  state: string;
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

  // Time info
  timeToDeadline: string | null;    // '23h 45m'
  timeToAutoSettle: string | null;  // '47h 15m'
}

const status = await client.basic.checkStatus('0x...');
if (status.canRelease) {
  // Use Standard API for state transitions and escrow release
  await client.standard.releaseEscrow(status.txId);
}
```

**Note:** For state transitions (release, cancel, dispute), use the Standard API:

```typescript
// Release payment to provider (after DELIVERED)
await client.standard.releaseEscrow(txId);

// Raise a dispute (after DELIVERED, within dispute window)
await client.standard.transitionState(txId, 'DISPUTED');

// Cancel transaction (before DELIVERED)
await client.standard.transitionState(txId, 'CANCELLED');
```

### `client.basic.getBalance(address?)`

Get USDC balance.

```typescript
const balance = await client.basic.getBalance();
// '1234.56'

const otherBalance = await client.basic.getBalance('0x...');
```

---

## Standard API Reference

### `client.standard.createTransaction(options)`

Create a transaction without funding.

```typescript
interface CreateOptions {
  provider: string;
  amount: bigint;       // In USDC base units (6 decimals)
  deadline: number;     // Unix timestamp
  disputeWindow: number; // Seconds
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

Lock funds in escrow. Requires prior USDC approval.

```typescript
// First approve USDC
await client.standard.approveUSDC(amount);

// Then link escrow
await client.standard.linkEscrow('0x...');
// State transitions to COMMITTED
```

### `client.standard.transitionState(txId, state, options?)`

Transition transaction to new state.

```typescript
// Provider marks as in-progress (REQUIRED before DELIVERED)
await client.standard.transitionState('0x...', 'IN_PROGRESS');

// Provider marks as delivered with ABI-encoded dispute window proof
const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const proof = abiCoder.encode(['uint256'], [172800]); // 2 days in seconds
await client.standard.transitionState('0x...', 'DELIVERED', proof);
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
  state: string;
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
  participant?: string; // Either requester or provider
  states?: string[];
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
}

const transactions = await client.standard.getTransactions({
  participant: myAddress,
  states: ['COMMITTED', 'IN_PROGRESS', 'DELIVERED'],
  limit: 100,
});
```

### `client.standard.on(event, handler)`

Subscribe to events.

```typescript
// State changes
client.standard.on('StateChanged', (event) => {
  console.log(event.txId, event.oldState, event.newState);
});

// New transactions for you
client.standard.on('TransactionCreated', (event) => {
  if (event.provider === myAddress) {
    handleNewJob(event);
  }
});

// Disputes
client.standard.on('DisputeRaised', (event) => {
  console.log('Dispute on', event.txId, event.reason);
});
```

### `client.standard.releaseEscrow(txId)`

Release funds to provider.

```typescript
await client.standard.releaseEscrow('0x...');
```

### Raising a Dispute

Raise dispute via state transition.

```typescript
// Transition to DISPUTED state (only valid from DELIVERED)
await client.standard.transitionState('0x...', 'DISPUTED');
```

---

## Advanced API Reference

### `client.advanced.kernel`

Direct access to ACTPKernel contract.

```typescript
const kernel = client.advanced.kernel;

// Call any contract method
const tx = await kernel.getTransaction('0x...');

// Populate transaction without sending
const unsignedTx = await kernel.populateTransaction.createTransaction(
  provider,
  amount,
  deadline,
  disputeWindow
);

// Query events
const filter = kernel.filters.StateChanged('0x...');
const events = await kernel.queryFilter(filter, fromBlock, toBlock);
```

### `client.advanced.escrow`

Direct access to EscrowVault contract.

```typescript
const escrow = client.advanced.escrow;

// Get escrow balance for transaction
const balance = await escrow.getBalance('0x...');

// Get total vault balance
const totalVault = await escrow.totalBalance();
```

### `client.advanced.usdc`

Direct access to USDC contract.

```typescript
const usdc = client.advanced.usdc;

// Check allowance
const allowance = await usdc.allowance(myAddress, kernelAddress);

// Approve spending
await usdc.approve(kernelAddress, amount);
```

### `client.advanced.createBatch()`

Batch multiple operations.

```typescript
const batch = client.advanced.createBatch();

// Add operations
batch.add(kernel.interface.encodeFunctionData('createTransaction', [...]));
batch.add(escrow.interface.encodeFunctionData('linkEscrow', [...]));

// Execute atomically (if multicall supported)
const results = await batch.execute();
```

### `client.advanced.estimateGas(tx)`

Custom gas estimation.

```typescript
const gas = await client.advanced.estimateGas({
  to: kernelAddress,
  data: kernel.interface.encodeFunctionData('createTransaction', [...]),
});

// Add buffer
const gasWithBuffer = gas * 120n / 100n;
```

---

## Error Types by Tier

### Basic API Errors

```typescript
try {
  await client.basic.pay({...});
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    console.log('Need more USDC');
  } else if (error instanceof InvalidAddressError) {
    console.log('Bad provider address');
  } else if (error instanceof TransactionFailedError) {
    console.log('On-chain error:', error.reason);
  }
}
```

### Standard API Errors

```typescript
try {
  await client.standard.transitionState(txId, 'DELIVERED');
} catch (error) {
  if (error instanceof InvalidStateTransitionError) {
    console.log('Cannot transition from', error.currentState);
  } else if (error instanceof NotAuthorizedError) {
    console.log('Only provider can deliver');
  }
}
```

### Advanced API Errors

```typescript
try {
  await kernel.createTransaction(...);
} catch (error) {
  // Raw ethers.js errors
  if (error.code === 'CALL_EXCEPTION') {
    const reason = kernel.interface.parseError(error.data);
    console.log('Revert reason:', reason);
  }
}
```
