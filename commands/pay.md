---
description: Create an ACTP or x402 payment with interactive guidance. Supports escrow payments (ACTP), instant payments (x402), and agent ID resolution (ERC-8004).
allowed-tools:
  - Read
  - Glob
  - AskUserQuestion
argument-hint: "[recipient] [amount]"
---

# /agirails:pay

Create an ACTP or x402 payment with interactive guidance.

## What This Command Does

1. Check if SDK is installed
2. Detect project language
3. Collect payment details (recipient, amount, deadline)
4. Detect payment type from recipient format (address, URL, or agent ID)
5. Validate inputs
6. Show payment summary with fee calculation
7. Generate ready-to-use code

## Payment Routing

How payment routing works based on recipient format:

```
Recipient Format     -> Payment Type
--------------------------------------------
Address (0x...)      -> ACTP escrow (multi-step, refundable)
URL (https://...)    -> x402 instant (single-step, non-refundable)
Agent ID (number)    -> Resolves via ERC-8004 -> ACTP escrow
```

## Step-by-Step Instructions

### Step 1: Check Prerequisites

Verify SDK is installed:
```
Check for node_modules/@agirails/sdk
```

If not installed:
```
"AGIRAILS SDK not found. Run /agirails:init first to install."
```

### Step 2: Collect Payment Details

If arguments provided, parse them. Otherwise, ask interactively:

**Recipient:**
```
"Enter the recipient (address, URL, or agent ID):"
```

Detect pattern:
- `0x...` (40 hex chars) -> ACTP escrow payment
- `https://...` -> x402 instant payment (requires X402Adapter)
- Number -> ERC-8004 agent ID resolution -> ACTP escrow

**For ACTP (0x... address):**

Validate:
- Is valid Ethereum address (0x + 40 hex chars)
- Is checksummed (or offer to checksum)
- Is not the same as requester address

**For x402 (https://... URL):**

Validate:
- Must be HTTPS (HTTP rejected for security)
- URL must be well-formed
- Warn user that x402 payments are instant and non-refundable

**For ERC-8004 (agent ID):**

Validate:
- Must be a positive integer
- Will be resolved to an address via ERC-8004 Identity Registry

**Amount:**
```
"Enter payment amount in USDC:"
```

Validate:
- Is a positive number
- Is >= $0.05 (minimum)
- Calculate and show fee: `max(amount * 1%, $0.05)`

**Deadline (ACTP only):**
```
"When should this payment expire?"
Options: [1 hour] [6 hours] [24 hours (Recommended)] [7 days] [Custom]
```

Note: x402 payments are instant and do not have a deadline.

### Step 3: Show Summary

**ACTP Escrow Payment:**
```
Payment Summary (ACTP Escrow):
+-------------------------------------+
| To:       0xAbc...123               |
| Amount:   $100.00 USDC              |
| Fee:      $1.00 (1%)                |
| Total:    $101.00 USDC              |
| Deadline: 2026-03-01 15:30 UTC      |
| Mode:     mock (no real funds)      |
| Type:     ACTP (escrow, refundable) |
+-------------------------------------+

Proceed?
Options: [Create Payment] [Edit Details] [Cancel]
```

**x402 Instant Payment:**
```
Payment Summary (x402 Instant):
+-------------------------------------+
| To:       https://api.example.com   |
| Amount:   $0.50 USDC                |
| Fee:      $0.05 (minimum)           |
| Total:    $0.55 USDC                |
| Mode:     x402 (instant, no refund) |
| Via:      X402Relay contract         |
+-------------------------------------+

Warning: x402 payments are instant and non-refundable.
Proceed?
Options: [Pay Now] [Edit Details] [Cancel]
```

### Step 4: Generate Code

**ACTP Escrow Payment (TypeScript):**
```typescript
import { ACTPClient } from '@agirails/sdk';

async function createPayment() {
  // Keystore auto-detected from .actp/keystore.json
  const client = await ACTPClient.create({
    mode: 'mock', // Change to 'testnet' or 'mainnet' for real transactions
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

**x402 Instant Payment (TypeScript):**
```typescript
import { ACTPClient, X402Adapter } from '@agirails/sdk';

async function createX402Payment() {
  // Keystore auto-detected from .actp/keystore.json
  const client = await ACTPClient.create({
    mode: 'testnet', // or 'mainnet'
  });

  // Register x402 adapter for URL-based payments
  client.registerAdapter(new X402Adapter(client.getAddress(), {
    expectedNetwork: 'base-sepolia', // or 'base-mainnet'
    // Provide your own USDC transfer function (signer = your ethers.Wallet)
    transferFn: async (to, amount) => {
      const usdc = new ethers.Contract(USDC_ADDRESS, ['function transfer(address,uint256) returns (bool)'], signer);
      return (await usdc.transfer(to, amount)).hash;
    },
  }));

  const result = await client.pay({
    to: 'https://api.example.com/translate',
    amount: 0.50,
    input: { text: 'Hello world', targetLang: 'es' },
  });

  console.log('Response:', result.response);
}

createX402Payment().catch(console.error);
```

### Step 5: Next Steps

**After ACTP escrow payment:**
```
Payment code generated!

To execute:
1. Save the code to a file (e.g., pay.ts)
2. Set ACTP_KEY_PASSWORD in your environment
3. Run: npx ts-node pay.ts

After payment is created:
- Monitor with: /agirails:status <txId>
- Watch live: /agirails:watch <txId>

The transaction will be in COMMITTED state, waiting for the provider to deliver.
```

**After x402 instant payment:**
```
Payment code generated!

To execute:
1. Save the code to a file (e.g., pay-x402.ts)
2. Set ACTP_KEY_PASSWORD in your environment
3. Run: npx ts-node pay-x402.ts

Note: x402 payments complete instantly. The response data is returned
directly from the provider endpoint. There is no transaction to monitor.
```

## Fee Calculation

Fees apply to both ACTP and x402 payments:

| Amount | Calculation | Fee |
|--------|-------------|-----|
| $0.50 | max($0.005, $0.05) | $0.05 |
| $1.00 | max($0.01, $0.05) | $0.05 |
| $5.00 | max($0.05, $0.05) | $0.05 |
| $10.00 | max($0.10, $0.05) | $0.10 |
| $100.00 | max($1.00, $0.05) | $1.00 |
| $1000.00 | max($10.00, $0.05) | $10.00 |

For x402, fees are enforced atomically by the X402Relay contract.

## Input Validation

| Input | Validation | Error Message |
|-------|------------|---------------|
| Address | Must be 0x + 40 hex chars | "Invalid Ethereum address format" |
| Address | Must not equal requester | "Cannot pay yourself" |
| URL | Must be HTTPS | "x402 requires HTTPS URLs for security" |
| URL | Must be well-formed | "Invalid URL format" |
| Agent ID | Must be positive integer | "Invalid agent ID" |
| Amount | Must be positive number | "Amount must be positive" |
| Amount | Must be >= $0.05 | "Minimum amount is $0.05 USDC" |
| Deadline | Must be in future (ACTP only) | "Deadline must be in the future" |
