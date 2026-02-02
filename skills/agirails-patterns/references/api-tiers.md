# API Tiers - Complete Reference

## Tier Comparison Matrix

| Feature | Basic | Standard | Advanced |
|---------|-------|----------|----------|
| **Abstraction** | Highest | Medium | Lowest |
| **Lines of code** | Fewest | Moderate | Most |
| **Lifecycle control** | Minimal | Explicit | Full |
| **Runtime access** | No | Partial | Full |
| **Event indexing** | No | No | Bring your own |
| **Raw contract access** | No | No | In blockchain modes (via runtime) |

## Basic API Reference

### `client.basic.pay(options)`

Create and fund a transaction in one call.

```typescript
interface PayOptions {
  to: string;           // Provider address
  amount: string | number; // Amount in USDC (e.g., '100.00')
  deadline?: string | number; // '+1h', '+24h', '+7d', or timestamp
  disputeWindow?: number; // Seconds (default: 172800 = 48h)
}

interface PayResult {
  txId: string;         // Transaction ID
  provider: string;     // Provider address
  requester: string;    // Requester address
  amount: string;       // Formatted amount ("100.00 USDC")
  deadline: string;     // ISO 8601 timestamp
  state: string;        // 'COMMITTED'
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
  state: string;
  canAccept: boolean;
  canComplete: boolean;
  canDispute: boolean;
}

const status = await client.basic.checkStatus('0x...');
if (status.canComplete) {
  // Provider can transition to IN_PROGRESS / DELIVERED
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

### `client.getBalance(address)`

Get USDC balance (mock mode only, returns wei).

```typescript
const balance = await client.getBalance('0x...');
```

---

## Standard API Reference

### `client.standard.createTransaction(options)`

Create a transaction without funding.

```typescript
interface CreateOptions {
  provider: string;
  amount: string | number;  // User-friendly format
  deadline?: string | number; // '+24h' or Unix timestamp
  disputeWindow?: number;   // Seconds
  serviceDescription?: string;
}

const txId = await client.standard.createTransaction({
  provider: '0x...',
  amount: '100',
  deadline: '+24h',
  disputeWindow: 172800,
});
// txId returned (state is INITIATED)
```

### `client.standard.linkEscrow(txId)`

Lock funds in escrow (auto-transitions to COMMITTED).

```typescript
await client.standard.linkEscrow('0x...');
```

### `client.standard.transitionState(txId, state, options?)`

Transition transaction to new state.

```typescript
import { ethers } from 'ethers';

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
  id: string;
  requester: string;
  provider: string;
  amount: string; // USDC wei (string)
  state: string;
  deadline: number;
  disputeWindow: number;
  completedAt: number | null;
  escrowId: string | null;
}

const tx = await client.standard.getTransaction('0x...');
```

**Note:** Standard API does not include event listeners or transaction queries.
For monitoring, use on-chain events (ethers/web3) or your own indexer.

### `client.standard.releaseEscrow(txId)`

Release funds to provider.

```typescript
// Mock mode (no attestation required)
await client.standard.releaseEscrow('0x...');

// Testnet/Mainnet (attestation required)
await client.standard.releaseEscrow('0x...', {
  txId: '0x...',
  attestationUID: '0x...',
});
```

### Raising a Dispute

Raise dispute via state transition.

```typescript
// Transition to DISPUTED state (only valid from DELIVERED)
await client.standard.transitionState('0x...', 'DISPUTED');
```

---

## Advanced API Reference

### `client.advanced` (IACTPRuntime)

Direct access to the runtime (lowest-level API).

```typescript
const runtime = client.advanced;

const txId = await runtime.createTransaction({
  provider: '0x...',
  requester: '0x...',
  amount: '100000000', // USDC wei (6 decimals)
  deadline: Math.floor(Date.now() / 1000) + 86400,
  disputeWindow: 172800,
});

const tx = await runtime.getTransaction(txId);
await runtime.transitionState(txId, 'IN_PROGRESS');
```

**Note:** In blockchain modes, the runtime also exposes contract instances
(`kernel`, `escrow`, `usdc`) on the concrete runtime object. These are not part
of the generic interface, so you may need to cast to `any` to access them.

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
import { ethers } from 'ethers';

try {
  await client.standard.transitionState(txId, 'IN_PROGRESS');
  const proof = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [172800]);
  await client.standard.transitionState(txId, 'DELIVERED', proof);
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
