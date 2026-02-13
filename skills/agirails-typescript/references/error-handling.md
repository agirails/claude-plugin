# TypeScript Error Handling

## Error Hierarchy

```
ACTPError (base — code, message, txHash?, details?)
├── InsufficientFundsError         (INSUFFICIENT_FUNDS)
├── TransactionNotFoundError       (TRANSACTION_NOT_FOUND)
├── DeadlineExpiredError           (DEADLINE_EXPIRED)
├── InvalidStateTransitionError    (INVALID_STATE_TRANSITION)
├── SignatureVerificationError     (SIGNATURE_VERIFICATION_FAILED)
├── TransactionRevertedError       (TRANSACTION_REVERTED)
├── NetworkError                   (NETWORK_ERROR)
├── NoProviderFoundError           (NO_PROVIDER_FOUND)
├── TimeoutError                   (TIMEOUT)
├── ProviderRejectedError          (PROVIDER_REJECTED)
├── DeliveryFailedError            (DELIVERY_FAILED)
├── DisputeRaisedError             (DISPUTE_RAISED)
├── ServiceConfigError             (SERVICE_CONFIG_ERROR)
├── AgentLifecycleError            (AGENT_LIFECYCLE_ERROR)
├── QueryCapExceededError          (QUERY_CAP_EXCEEDED)
├── ValidationError                (VALIDATION_ERROR)
│   ├── InvalidAddressError
│   ├── InvalidAmountError
│   └── InvalidCIDError
└── StorageError                   (STORAGE_ERROR)
    ├── InsufficientBalanceError   (Irys/Arweave balance, NOT payment balance)
    ├── ContentNotFoundError
    └── ...other storage errors
```

## Importing Errors

```typescript
import {
  ACTPError,
  InsufficientFundsError,
  TransactionNotFoundError,
  InvalidStateTransitionError,
  DeadlineExpiredError,
  InvalidAddressError,
  InvalidAmountError,
  ValidationError,
  NetworkError,
  NoProviderFoundError,
  TimeoutError,
} from '@agirails/sdk';
```

## Error Details

All errors extend `ACTPError` with: `error.code`, `error.message`, `error.txHash?`, `error.details?`.

### InsufficientFundsError

Thrown when wallet doesn't have enough USDC for payment.

```typescript
// details: { required: string (wei), available: string (wei) }

try {
  await client.basic.pay({ to: '0x...', amount: 10000 });
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    console.log(`Need ${error.details.required} wei`);
    console.log(`Have ${error.details.available} wei`);

    // In mock mode, mint more
    if (client.getMode() === 'mock') {
      await client.mintTokens(client.getAddress(), error.details.required);
    }
  }
}
```

### InvalidAddressError

Thrown when an Ethereum address is invalid.

```typescript
try {
  await client.basic.pay({ to: 'not-an-address', amount: 10 });
} catch (error) {
  if (error instanceof InvalidAddressError) {
    console.log(error.message); // "Invalid Ethereum address: not-an-address"
  }
}
```

### InvalidAmountError

Thrown when amount is invalid.

```typescript
try {
  await client.basic.pay({ to: '0x...', amount: 0 });
} catch (error) {
  if (error instanceof InvalidAmountError) {
    console.log(error.message); // "Invalid amount: 0 (must be > 0)"
  }
}
```

### TransactionNotFoundError

Thrown when transaction ID doesn't exist.

```typescript
// details: { txId: string }

try {
  await client.basic.checkStatus('0xinvalid');
} catch (error) {
  if (error instanceof TransactionNotFoundError) {
    console.log(`Transaction ${error.details.txId} not found`);
  }
}
```

### InvalidStateTransitionError

Thrown when state transition is not allowed.

```typescript
// details: { from: string, to: string, validTransitions: string[] }

try {
  await client.standard.releaseEscrow('0x...');
} catch (error) {
  if (error instanceof InvalidStateTransitionError) {
    console.log(`Cannot go from ${error.details.from} to ${error.details.to}`);
    console.log(`Valid: ${error.details.validTransitions.join(', ')}`);
  }
}
```

### DeadlineExpiredError

Thrown when deadline has passed.

```typescript
// details: { txId: string, deadline: number }

try {
  await client.standard.transitionState('0x...', 'IN_PROGRESS');
} catch (error) {
  if (error instanceof DeadlineExpiredError) {
    const deadlineDate = new Date(error.details.deadline * 1000);
    console.log(`Deadline was ${deadlineDate.toISOString()}`);
    // Transaction can now be cancelled
  }
}
```

### NoProviderFoundError

Thrown when `request()` cannot find any provider for the service.

```typescript
// details: { service: string }

try {
  const result = await request('rare-service', { input: { text: 'hello' }, budget: 5 });
} catch (error) {
  if (error instanceof NoProviderFoundError) {
    console.log(`No providers for: ${error.details.service}`);
  }
}
```

## Comprehensive Error Handler

```typescript
import { ACTPError } from '@agirails/sdk';

async function handlePayment(options: BasicPayParams) {
  try {
    return await client.basic.pay(options);
  } catch (error) {
    if (!(error instanceof ACTPError)) {
      throw error;
    }

    console.error('ACTP Error:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    switch (error.code) {
      case 'INSUFFICIENT_FUNDS':
        return { error: 'insufficient_funds', details: error.details };

      case 'INVALID_ADDRESS':
      case 'VALIDATION_ERROR':
        return { error: 'bad_input', details: error.details };

      case 'DEADLINE_EXPIRED':
        return { error: 'too_late', details: error.details };

      case 'NETWORK_ERROR':
      case 'TRANSACTION_REVERTED':
        return { error: 'network_issue', details: error.details };

      default:
        return { error: 'payment_failed', details: error.details };
    }
  }
}
```

## Retry Pattern

```typescript
async function payWithRetry(
  options: BasicPayParams,
  maxRetries = 3,
  delay = 1000
): Promise<BasicPayResult> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.basic.pay(options);
    } catch (error) {
      lastError = error as Error;

      // Don't retry validation errors
      if (error instanceof ValidationError) {
        throw error;
      }

      // Retry network errors
      if (error instanceof NetworkError) {
        console.log(`Attempt ${attempt} failed, retrying...`);
        await new Promise(r => setTimeout(r, delay * attempt));
        continue;
      }

      throw error;
    }
  }

  throw lastError!;
}
```

## Async Error Boundaries

```typescript
// For Express/Koa middleware
function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (error instanceof ACTPError) {
        res.status(400).json({
          error: error.code,
          message: error.message,
        });
      } else {
        next(error);
      }
    });
  };
}

// Usage
app.post('/pay', asyncHandler(async (req, res) => {
  const result = await client.basic.pay(req.body);
  res.json(result);
}));
```
