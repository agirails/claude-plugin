# AGIRAILS SDK Error Reference

Complete reference for all error types in the AGIRAILS SDK.

## Error Hierarchy

```
ACTPError (base)
│
├── Transaction Errors
│   ├── InsufficientFundsError      Code: INSUFFICIENT_FUNDS
│   ├── TransactionNotFoundError    Code: TRANSACTION_NOT_FOUND
│   ├── DeadlineExpiredError        Code: DEADLINE_EXPIRED
│   ├── EscrowNotFoundError         Code: ESCROW_NOT_FOUND (Python)
│   ├── DeadlinePassedError         Code: DEADLINE_PASSED (Python)
│   ├── DisputeWindowActiveError    Code: DISPUTE_WINDOW_ACTIVE (Python)
│   └── ContractPausedError         Code: CONTRACT_PAUSED (Python)
│
├── State Machine Errors
│   └── InvalidStateTransitionError Code: INVALID_STATE_TRANSITION
│
├── Validation Errors
│   ├── ValidationError             Code: VALIDATION_ERROR
│   ├── InvalidAddressError         Code: VALIDATION_ERROR
│   └── InvalidAmountError          Code: VALIDATION_ERROR
│
├── Network Errors
│   ├── NetworkError                Code: NETWORK_ERROR
│   ├── TransactionRevertedError    Code: TRANSACTION_REVERTED
│   └── SignatureVerificationError  Code: SIGNATURE_VERIFICATION_FAILED
│
├── Storage Errors (IPFS/Arweave)
│   ├── StorageError                Code: STORAGE_ERROR
│   ├── InvalidCIDError             Code: VALIDATION_ERROR
│   ├── UploadTimeoutError          Code: STORAGE_ERROR
│   ├── DownloadTimeoutError        Code: STORAGE_ERROR
│   ├── FileSizeLimitExceededError  Code: STORAGE_ERROR
│   ├── StorageAuthenticationError  Code: STORAGE_ERROR
│   ├── StorageRateLimitError       Code: STORAGE_ERROR
│   ├── ContentNotFoundError        Code: STORAGE_ERROR
│   ├── ArweaveUploadError          Code: STORAGE_ERROR
│   ├── ArweaveDownloadError        Code: STORAGE_ERROR
│   ├── ArweaveTimeoutError         Code: STORAGE_ERROR
│   ├── InvalidArweaveTxIdError     Code: VALIDATION_ERROR
│   ├── InsufficientBalanceError    Code: STORAGE_ERROR (Irys)
│   └── SwapExecutionError          Code: STORAGE_ERROR
│
├── Agent/Job Errors (Level 0/1 API)
│   ├── NoProviderFoundError        Code: NO_PROVIDER_FOUND
│   ├── TimeoutError                Code: TIMEOUT
│   ├── ProviderRejectedError       Code: PROVIDER_REJECTED
│   ├── DeliveryFailedError         Code: DELIVERY_FAILED
│   ├── DisputeRaisedError          Code: DISPUTE_RAISED
│   ├── ServiceConfigError          Code: SERVICE_CONFIG_ERROR
│   ├── AgentLifecycleError         Code: AGENT_LIFECYCLE_ERROR
│   └── QueryCapExceededError       Code: QUERY_CAP_EXCEEDED
│
└── Mock Errors (Python only)
    ├── MockStateCorruptedError
    ├── MockStateVersionError
    └── MockStateLockError
```

---

## Transaction Errors

### InsufficientFundsError / InsufficientBalanceError

**When:** Not enough USDC to complete payment.

**TypeScript:**
```typescript
import { InsufficientFundsError } from '@agirails/sdk';

try {
  await client.basic.pay({ to, amount: 1000 });
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    console.log('Required:', error.details.required);   // "1000000000"
    console.log('Available:', error.details.available); // "500000000"
    // Mint more test USDC in mock mode
    await client.mintTokens(address, '1000000000');
  }
}
```

**Python:**
```python
from agirails import InsufficientBalanceError

try:
    await client.basic.pay({"to": to, "amount": 1000})
except InsufficientBalanceError as e:
    print(f"Required: {e.details['required']}")   # "1000000000"
    print(f"Available: {e.details['available']}") # "500000000"
    await client.mint_tokens(address, "1000000000")
```

### TransactionNotFoundError

**When:** Transaction ID doesn't exist.

```typescript
try {
  await client.basic.checkStatus('0xinvalid...');
} catch (error) {
  if (error instanceof TransactionNotFoundError) {
    console.log('Transaction not found:', error.details.txId);
  }
}
```

### DeadlineExpiredError

**When:** Attempting action on expired transaction.

```typescript
try {
  await client.standard.linkEscrow(txId);
} catch (error) {
  if (error instanceof DeadlineExpiredError) {
    console.log('Deadline:', new Date(error.details.deadline * 1000));
    // Create new transaction with longer deadline
  }
}
```

---

## State Machine Errors

### InvalidStateTransitionError

**When:** Attempting invalid state transition.

```typescript
import { InvalidStateTransitionError } from '@agirails/sdk';

try {
  // Trying to deliver a SETTLED transaction
  await client.standard.transitionState(txId, 'DELIVERED');
} catch (error) {
  if (error instanceof InvalidStateTransitionError) {
    console.log('From:', error.details.from);           // "SETTLED"
    console.log('To:', error.details.to);               // "DELIVERED"
    console.log('Valid:', error.details.validTransitions); // [] (terminal)
  }
}
```

**Valid Transitions:**
| From | Valid To States |
|------|-----------------|
| INITIATED | QUOTED, COMMITTED, CANCELLED |
| QUOTED | COMMITTED, CANCELLED |
| COMMITTED | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | DELIVERED, CANCELLED |
| DELIVERED | SETTLED, DISPUTED |
| DISPUTED | SETTLED, CANCELLED (admin) |
| SETTLED | (terminal) |
| CANCELLED | (terminal) |

---

## Validation Errors

### InvalidAddressError

**When:** Ethereum address format is invalid.

```typescript
try {
  await client.basic.pay({ to: 'not-an-address', amount: 100 });
} catch (error) {
  if (error instanceof InvalidAddressError) {
    // Prompt user for valid 0x... address
  }
}
```

### InvalidAmountError

**When:** Amount is invalid (zero, negative, wrong format).

```typescript
try {
  await client.basic.pay({ to, amount: -100 });
} catch (error) {
  if (error instanceof InvalidAmountError) {
    // Amount must be > 0
  }
}
```

---

## Network Errors

### NetworkError

**When:** RPC connection or blockchain issues.

```typescript
try {
  await client.basic.pay({ to, amount });
} catch (error) {
  if (error instanceof NetworkError) {
    console.log('Network:', error.details.network);
    // Implement retry with exponential backoff
    await retry(() => client.basic.pay({ to, amount }), {
      maxAttempts: 3,
      delayMs: 1000,
    });
  }
}
```

### TransactionRevertedError

**When:** Blockchain transaction reverted.

```typescript
try {
  await client.standard.releaseEscrow(escrowId);
} catch (error) {
  if (error instanceof TransactionRevertedError) {
    console.log('Tx Hash:', error.txHash);
    console.log('Reason:', error.details.reason);
  }
}
```

---

## Storage Errors

### UploadTimeoutError

**When:** File upload times out.

```typescript
try {
  await storage.upload(largeFile);
} catch (error) {
  if (error instanceof UploadTimeoutError) {
    console.log('Timeout after:', error.details.timeoutMs, 'ms');
    // Retry with smaller chunks or increase timeout
  }
}
```

### ContentNotFoundError

**When:** IPFS CID not found on network.

```typescript
try {
  const content = await storage.download(cid);
} catch (error) {
  if (error instanceof ContentNotFoundError) {
    console.log('CID not found:', error.details.cid);
    // Content may have been garbage collected
  }
}
```

### StorageRateLimitError

**When:** Rate limit exceeded.

```typescript
try {
  await storage.upload(file);
} catch (error) {
  if (error instanceof StorageRateLimitError) {
    const retryAfter = error.details.retryAfter || 60;
    await sleep(retryAfter * 1000);
    // Retry after delay
  }
}
```

---

## Agent/Job Errors

### NoProviderFoundError

**When:** No provider offers the requested service.

```typescript
import { request, NoProviderFoundError } from '@agirails/sdk';

try {
  await request({ service: 'rare-service', input: {} });
} catch (error) {
  if (error instanceof NoProviderFoundError) {
    console.log('Service:', error.details.service);
    // List available services or suggest alternatives
  }
}
```

### ProviderRejectedError

**When:** Provider explicitly rejects job (e.g., budget too low).

```typescript
try {
  await request({ service: 'image-gen', input: {}, maxPrice: '0.01' });
} catch (error) {
  if (error instanceof ProviderRejectedError) {
    console.log('Provider:', error.details.provider);
    console.log('Reason:', error.details.reason);
    // Increase budget and retry
  }
}
```

### QueryCapExceededError

**When:** Agent registry too large for on-chain queries.

```typescript
try {
  await registry.queryAgentsByService({ service: 'popular' });
} catch (error) {
  if (error instanceof QueryCapExceededError) {
    console.log('Registry size:', error.details.registrySize);
    console.log('Max allowed:', error.details.maxQueryAgents);
    // Use off-chain indexer (The Graph, Goldsky)
  }
}
```

---

## Error Handling Patterns

### Comprehensive Handler

```typescript
import { ACTPError } from '@agirails/sdk';

async function handlePayment(to: string, amount: number) {
  try {
    return await client.basic.pay({ to, amount });
  } catch (error) {
    if (!(error instanceof ACTPError)) throw error;

    switch (error.code) {
      case 'INSUFFICIENT_FUNDS':
        throw new Error('Please add more USDC to your wallet');
      case 'INVALID_STATE_TRANSITION':
        throw new Error('Transaction is in an unexpected state');
      case 'DEADLINE_EXPIRED':
        throw new Error('Transaction expired, please create a new one');
      case 'NETWORK_ERROR':
        // Retry logic
        return handlePayment(to, amount);
      default:
        console.error(`Unexpected error [${error.code}]:`, error);
        throw error;
    }
  }
}
```

### Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof NetworkError && attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Unreachable');
}

// Usage
const result = await withRetry(() => client.basic.pay({ to, amount }));
```

### Python Async Error Handling

```python
from agirails import (
    ACTPError,
    InsufficientBalanceError,
    NetworkError,
)
import asyncio

async def handle_payment(to: str, amount: float, retries: int = 3):
    for attempt in range(retries):
        try:
            return await client.basic.pay({"to": to, "amount": amount})
        except InsufficientBalanceError:
            raise ValueError("Please add more USDC to your wallet")
        except NetworkError:
            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt)
                continue
            raise
        except ACTPError as e:
            print(f"ACTP Error [{e.code}]: {e}")
            raise
```

---

## Error Codes Reference

| Code | Error Class | Description |
|------|-------------|-------------|
| `INSUFFICIENT_FUNDS` | InsufficientFundsError | Not enough USDC |
| `TRANSACTION_NOT_FOUND` | TransactionNotFoundError | Invalid tx ID |
| `INVALID_STATE_TRANSITION` | InvalidStateTransitionError | Bad state change |
| `DEADLINE_EXPIRED` | DeadlineExpiredError | Past deadline |
| `VALIDATION_ERROR` | ValidationError | Input validation failed |
| `NETWORK_ERROR` | NetworkError | RPC/connection issue |
| `TRANSACTION_REVERTED` | TransactionRevertedError | Blockchain revert |
| `SIGNATURE_VERIFICATION_FAILED` | SignatureVerificationError | Bad signature |
| `STORAGE_ERROR` | StorageError | IPFS/Arweave issue |
| `NO_PROVIDER_FOUND` | NoProviderFoundError | No matching provider |
| `TIMEOUT` | TimeoutError | Operation timeout |
| `PROVIDER_REJECTED` | ProviderRejectedError | Provider refused job |
| `DELIVERY_FAILED` | DeliveryFailedError | Delivery incomplete |
| `DISPUTE_RAISED` | DisputeRaisedError | Transaction disputed |
| `SERVICE_CONFIG_ERROR` | ServiceConfigError | Bad service config |
| `AGENT_LIFECYCLE_ERROR` | AgentLifecycleError | Invalid agent state |
| `QUERY_CAP_EXCEEDED` | QueryCapExceededError | Registry too large |
