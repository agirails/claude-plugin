---
description: Create an ACTP payment interactively. Guides through provider address, amount, deadline, and generates ready-to-use code.
allowed-tools:
  - Read
  - Glob
  - AskUserQuestion
argument-hint: "[provider_address] [amount]"
---

# /agirails:pay

Create an ACTP payment with interactive guidance.

## What This Command Does

1. Check if SDK is installed
2. Detect project language
3. Collect payment details (provider, amount, deadline)
4. Validate inputs
5. Show payment summary with fee calculation
6. Generate ready-to-use code

## Step-by-Step Instructions

### Step 1: Check Prerequisites

Verify SDK is installed:
```
TypeScript: Check for node_modules/@agirails/sdk
Python: Check if agirails is importable
```

If not installed:
```
"AGIRAILS SDK not found. Run /agirails:init first to install."
```

### Step 2: Collect Payment Details

If arguments provided, parse them. Otherwise, ask interactively:

**Provider Address:**
```
"Enter the provider's Ethereum address:"
```

Validate:
- Is valid Ethereum address (0x + 40 hex chars)
- Is checksummed (or offer to checksum)
- Is not the same as requester address

**Amount:**
```
"Enter payment amount in USDC:"
```

Validate:
- Is a positive number
- Is >= $0.05 (minimum)
- Calculate and show fee: `max(amount × 1%, $0.05)`

**Deadline:**
```
"When should this payment expire?"
Options: [1 hour] [6 hours] [24 hours (Recommended)] [7 days] [Custom]
```

### Step 3: Show Summary

```
Payment Summary:
┌─────────────────────────────────────┐
│ To:       0xAbc...123               │
│ Amount:   $100.00 USDC              │
│ Fee:      $1.00 (1%)                │
│ Total:    $101.00 USDC              │
│ Deadline: 2025-12-28 15:30 UTC      │
│ Mode:     mock (no real funds)      │
└─────────────────────────────────────┘

Proceed?
Options: [Create Payment] [Edit Details] [Cancel]
```

### Step 4: Generate Code

**TypeScript:**
```typescript
import { ACTPClient } from '@agirails/sdk';

async function createPayment() {
  const client = await ACTPClient.create({
    mode: 'mock', // Change to 'testnet' or 'mainnet' for real transactions
    requesterAddress: '0xYourAddress',
  });

  const result = await client.basic.pay({
    to: '0xProviderAddress',
    amount: '100.00',
    deadline: '+24h',
  });

  console.log('Payment created!');
  console.log('Transaction ID:', result.txId);
  console.log('State:', result.state);
  console.log('Amount:', result.amount);

  return result;
}

createPayment().catch(console.error);
```

**Python:**
```python
import asyncio
from agirails import ACTPClient

async def create_payment():
    client = await ACTPClient.create(
        mode="mock",  # Change to 'testnet' or 'mainnet' for real transactions
        requester_address="0xYourAddress",
    )

    result = await client.basic.pay({
        "to": "0xProviderAddress",
        "amount": 100.00,
        "deadline": "24h",
    })

    print("Payment created!")
    print(f"Transaction ID: {result.tx_id}")
    print(f"State: {result.state}")
    print(f"Amount: {result.amount}")

    return result

if __name__ == "__main__":
    asyncio.run(create_payment())
```

### Step 5: Next Steps

```
Payment code generated!

To execute:
1. Save the code to a file (e.g., pay.ts or pay.py)
2. Update 'requesterAddress' with your address
3. Run: npx ts-node pay.ts (or python pay.py)

After payment is created:
- Monitor with: /agirails:status <txId>
- Watch live: /agirails:watch <txId>

The transaction will be in COMMITTED state, waiting for the provider to deliver.
```

## Fee Calculation

| Amount | Calculation | Fee |
|--------|-------------|-----|
| $1.00 | max($0.01, $0.05) | $0.05 |
| $5.00 | max($0.05, $0.05) | $0.05 |
| $10.00 | max($0.10, $0.05) | $0.10 |
| $100.00 | max($1.00, $0.05) | $1.00 |
| $1000.00 | max($10.00, $0.05) | $10.00 |

## Input Validation

| Input | Validation | Error Message |
|-------|------------|---------------|
| Address | Must be 0x + 40 hex chars | "Invalid Ethereum address format" |
| Address | Must not equal requester | "Cannot pay yourself" |
| Amount | Must be positive number | "Amount must be positive" |
| Amount | Must be >= $0.05 | "Minimum amount is $0.05 USDC" |
| Deadline | Must be in future | "Deadline must be in the future" |
