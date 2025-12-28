# TypeScript Error Handling

## Error Hierarchy

```
ACTPError (base)
├── ValidationError
│   ├── InvalidAddressError
│   ├── InvalidAmountError
│   └── InvalidStateError
├── StateError
│   ├── TransactionNotFoundError
│   ├── InvalidStateTransitionError
│   └── DeadlineExpiredError
├── AuthorizationError
│   └── NotAuthorizedError
├── BalanceError
│   └── InsufficientBalanceError
└── NetworkError
    ├── RpcError
    └── TransactionFailedError
```

## Importing Errors

```typescript
import {
  ACTPError,
  ValidationError,
  InvalidAddressError,
  InvalidAmountError,
  TransactionNotFoundError,
  InvalidStateTransitionError,
  InsufficientBalanceError,
  NotAuthorizedError,
  DeadlineExpiredError,
  NetworkError,
} from '@agirails/sdk';
```

## Error Details

### InvalidAddressError

Thrown when an Ethereum address is invalid.

```typescript
interface InvalidAddressError extends ValidationError {
  address: string;  // The invalid address
  reason: string;   // 'not checksummed' | 'invalid format' | 'zero address'
}

try {
  await client.basic.pay({ to: 'not-an-address', ... });
} catch (error) {
  if (error instanceof InvalidAddressError) {
    console.log(`Invalid address: ${error.address}`);
    console.log(`Reason: ${error.reason}`);
  }
}
```

### InvalidAmountError

Thrown when amount is invalid.

```typescript
interface InvalidAmountError extends ValidationError {
  amount: string;
  reason: string;  // 'negative' | 'zero' | 'below minimum' | 'not a number'
  minimum?: string;
}

try {
  await client.basic.pay({ amount: '0.01', ... }); // Below $0.05 minimum
} catch (error) {
  if (error instanceof InvalidAmountError) {
    console.log(`Amount ${error.amount} invalid: ${error.reason}`);
    console.log(`Minimum: ${error.minimum}`);
  }
}
```

### TransactionNotFoundError

Thrown when transaction ID doesn't exist.

```typescript
interface TransactionNotFoundError extends StateError {
  txId: string;
  mode: string;  // 'mock' | 'testnet' | 'mainnet'
}

try {
  await client.basic.checkStatus('0xinvalid');
} catch (error) {
  if (error instanceof TransactionNotFoundError) {
    console.log(`Transaction ${error.txId} not found in ${error.mode}`);
  }
}
```

### InvalidStateTransitionError

Thrown when state transition is not allowed.

```typescript
interface InvalidStateTransitionError extends StateError {
  txId: string;
  currentState: TransactionState;
  targetState: TransactionState;
  allowedTransitions: TransactionState[];
}

try {
  // Try to release before delivered
  await client.basic.release('0x...');
} catch (error) {
  if (error instanceof InvalidStateTransitionError) {
    console.log(`Cannot transition from ${error.currentState} to ${error.targetState}`);
    console.log(`Allowed: ${error.allowedTransitions.join(', ')}`);
  }
}
```

### InsufficientBalanceError

Thrown when wallet doesn't have enough funds.

```typescript
interface InsufficientBalanceError extends BalanceError {
  required: string;   // Amount needed (including fee)
  available: string;  // Current balance
  token: string;      // 'USDC' or 'ETH'
}

try {
  await client.basic.pay({ amount: '10000', ... });
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    console.log(`Need ${error.required} ${error.token}`);
    console.log(`Have ${error.available} ${error.token}`);

    // In mock mode, mint more
    if (client.mode === 'mock') {
      await client.mock.mint(address, parseFloat(error.required));
    }
  }
}
```

### NotAuthorizedError

Thrown when caller is not authorized for action.

```typescript
interface NotAuthorizedError extends AuthorizationError {
  txId: string;
  action: string;      // 'release' | 'cancel' | 'transition'
  caller: string;      // Address that tried to call
  authorized: string;  // Address that should call
}

try {
  // Provider tries to release (only requester can)
  await client.basic.release('0x...');
} catch (error) {
  if (error instanceof NotAuthorizedError) {
    console.log(`${error.caller} cannot ${error.action}`);
    console.log(`Only ${error.authorized} can do this`);
  }
}
```

### DeadlineExpiredError

Thrown when deadline has passed.

```typescript
interface DeadlineExpiredError extends StateError {
  txId: string;
  deadline: Date;
  now: Date;
}

try {
  await client.standard.transitionState('0x...', 'DELIVERED');
} catch (error) {
  if (error instanceof DeadlineExpiredError) {
    console.log(`Deadline was ${error.deadline}`);
    console.log(`Current time is ${error.now}`);
    // Transaction can now be cancelled
  }
}
```

## Comprehensive Error Handler

```typescript
import { ACTPError } from '@agirails/sdk';

async function handlePayment(options: PayOptions) {
  try {
    return await client.basic.pay(options);
  } catch (error) {
    if (!(error instanceof ACTPError)) {
      // Unknown error, rethrow
      throw error;
    }

    // Log for debugging
    console.error('ACTP Error:', {
      name: error.name,
      message: error.message,
      code: error.code,
    });

    // Handle by type
    switch (error.code) {
      case 'INSUFFICIENT_BALANCE':
        return { error: 'insufficient_funds', details: error };

      case 'INVALID_ADDRESS':
        return { error: 'bad_address', details: error };

      case 'DEADLINE_EXPIRED':
        return { error: 'too_late', details: error };

      default:
        return { error: 'payment_failed', details: error };
    }
  }
}
```

## Retry Pattern

```typescript
async function payWithRetry(
  options: PayOptions,
  maxRetries = 3,
  delay = 1000
): Promise<PayResult> {
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

      // Don't retry authorization errors
      if (error instanceof NotAuthorizedError) {
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
