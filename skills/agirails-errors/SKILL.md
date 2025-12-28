# AGIRAILS Error Handling

Use this skill when the user encounters errors, needs help with error handling patterns, or wants to understand the SDK's exception hierarchy.

## Trigger

This skill should activate when the user:
- Encounters an ACTP error (e.g., "InsufficientFundsError", "InvalidStateTransitionError")
- Asks about error handling best practices
- Needs to implement try/catch patterns for ACTP
- Sees error codes like "INSUFFICIENT_FUNDS", "INVALID_STATE_TRANSITION"
- Has issues with storage, network, or validation errors

## Key Concepts

### Error Hierarchy

All SDK errors extend `ACTPError` which provides:
- `code` - Machine-readable error code (e.g., 'INSUFFICIENT_FUNDS')
- `message` - Human-readable description
- `details` - Additional context object
- `txHash` - Related transaction hash (TypeScript only)

### Error Categories

| Category | Common Errors | When They Occur |
|----------|---------------|-----------------|
| **Transaction** | `InsufficientFundsError`, `TransactionNotFoundError` | Payment operations |
| **State** | `InvalidStateTransitionError`, `DeadlineExpiredError` | State machine operations |
| **Validation** | `InvalidAddressError`, `InvalidAmountError` | Input validation |
| **Network** | `NetworkError`, `TransactionRevertedError` | Blockchain operations |
| **Storage** | `UploadTimeoutError`, `ContentNotFoundError` | IPFS/Arweave operations |
| **Agent** | `NoProviderFoundError`, `ProviderRejectedError` | Level 0/1 API |

### Quick Reference

**TypeScript:**
```typescript
import { ACTPError, InsufficientFundsError } from '@agirails/sdk';

try {
  await client.basic.pay({ to, amount });
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    // Handle specific error
  } else if (error instanceof ACTPError) {
    // Handle any ACTP error
    console.log(`Error [${error.code}]:`, error.message);
  }
}
```

**Python:**
```python
from agirails import ACTPError, InsufficientBalanceError

try:
    await client.basic.pay({"to": to, "amount": amount})
except InsufficientBalanceError as e:
    # Handle specific error
    pass
except ACTPError as e:
    # Handle any ACTP error
    print(f"Error [{e.code}]: {e}")
```

## References

- `references/error-reference.md` - Complete error type documentation with examples
