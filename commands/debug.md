---
description: Debug ACTP transaction issues with automatic diagnosis and fix suggestions.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
argument-hint: "<transaction_id_or_error>"
---

# /agirails:debug

Diagnose and fix common ACTP integration issues.

## What This Command Does

1. Identify issue type (transaction error, SDK error, network error)
2. Run diagnostic checks
3. Explain root cause
4. Provide actionable fix

## Step-by-Step Instructions

### Step 1: Identify Issue Type

If transaction ID provided:
- Fetch transaction details
- Check state validity
- Verify escrow balance

If error message provided:
- Parse error type
- Match against known patterns

If neither:
```
"What issue are you experiencing?"
Options:
  [Transaction stuck]
  [SDK error]
  [Payment failed]
  [Connection issues]
  [Other - describe]
```

### Step 2: Common Error Patterns

| Error | Cause | Fix |
|-------|-------|-----|
| `INSUFFICIENT_BALANCE` | Not enough USDC | Mint test USDC (mock) or add funds |
| `INVALID_STATE_TRANSITION` | Wrong state for action | Check current state with /agirails:status |
| `DEADLINE_PASSED` | Transaction expired | Create new transaction with longer deadline |
| `NOT_AUTHORIZED` | Wrong caller | Use correct address (requester vs provider) |
| `CONTRACT_PAUSED` | Emergency pause active | Wait for unpause |
| `ESCROW_NOT_LINKED` | No funds locked | Call linkEscrow() first |

### Step 3: Diagnostic Commands

**Check SDK Connection:**
```typescript
// Test connection
const client = await ACTPClient.create({ mode: 'mock' });
console.log('Connected:', client.isConnected);
console.log('Mode:', client.mode);
console.log('Network:', client.network);
```

**Check Transaction State:**
```typescript
const tx = await client.standard.getTransaction('0x...');
console.log('State:', tx.state);
console.log('Requester:', tx.requester);
console.log('Provider:', tx.provider);
console.log('Amount:', tx.amount);
console.log('Deadline:', new Date(tx.deadline * 1000));
console.log('Is expired:', tx.deadline < Date.now() / 1000);
```

**Check Balances:**
```typescript
const balance = await client.basic.getBalance();
const escrowBalance = await client.standard.getEscrowBalance('0x...');
console.log('USDC Balance:', balance);
console.log('Locked in Escrow:', escrowBalance);
```

### Step 4: Mode-Specific Debugging

**Mock Mode Issues:**
```
Common Mock Mode Problems:
1. "Transaction not found" - Mock state resets on restart
   Fix: Re-create transaction or persist mock state

2. "Balance is 0" - Need to mint test tokens
   Fix: await client.mock.mint('0xYourAddress', 1000);

3. "Different results than testnet" - Mock simplifies blockchain behavior
   Fix: Test critical paths on testnet before mainnet
```

**Testnet Issues:**
```
Common Testnet Problems:
1. "Transaction pending forever" - Network congestion or low gas
   Fix: Check https://sepolia.basescan.org for transaction status

2. "Nonce too low" - Previous tx not confirmed
   Fix: Wait for previous tx or reset nonce

3. "Insufficient funds for gas" - Need testnet ETH
   Fix: Use Base Sepolia faucet
```

### Step 5: State Machine Debugging

```
Transaction State Flow:
INITIATED → Can: linkEscrow(), cancel()
QUOTED → Can: linkEscrow(), cancel()
COMMITTED → Can: transitionState(IN_PROGRESS/DELIVERED), cancel()
IN_PROGRESS → Can: transitionState(DELIVERED)
DELIVERED → Can: release(), dispute()
DISPUTED → Waiting for: resolution
SETTLED → Terminal (no actions)
CANCELLED → Terminal (no actions)
```

**State Transition Errors:**
```typescript
// Check if transition is valid
const canTransition = await client.standard.canTransition(txId, 'DELIVERED');
console.log('Can transition to DELIVERED:', canTransition);
if (!canTransition) {
  const current = await client.standard.getTransaction(txId);
  console.log('Current state:', current.state);
  console.log('Valid next states:', getValidTransitions(current.state));
}
```

### Step 6: Output Format

```
┌─────────────────────────────────────────────────────────────────┐
│  DIAGNOSTIC RESULTS                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Issue: Transaction stuck in COMMITTED state                    │
│                                                                 │
│  Root Cause:                                                    │
│  Provider has not delivered yet. Transaction deadline           │
│  is in 23h 45m.                                                 │
│                                                                 │
│  Available Actions:                                             │
│  1. Wait for provider to deliver                                │
│  2. Cancel transaction (you'll get full refund)                 │
│                                                                 │
│  Code to Cancel:                                                │
│  await client.basic.cancel('0x...');                            │
│                                                                 │
│  Note: After cancellation, funds return to your wallet          │
│  within 1-2 blocks (~4 seconds on Base).                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Error Recovery Patterns

### Transaction Stuck

```typescript
// Step 1: Check state
const status = await client.basic.checkStatus(txId);

// Step 2: Determine action based on state
switch (status.state) {
  case 'COMMITTED':
    // Wait or cancel
    if (status.isDeadlinePassed) {
      await client.basic.cancel(txId);
    }
    break;
  case 'DELIVERED':
    // Release or dispute
    if (status.isDeliveryAcceptable) {
      await client.basic.release(txId);
    } else {
      await client.basic.dispute(txId, { reason: 'Issue description' });
    }
    break;
  case 'DISPUTED':
    // Wait for resolution
    console.log('Waiting for mediator resolution');
    break;
}
```

### Connection Reset

```typescript
// Reconnect pattern
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const result = await withRetry(() => client.basic.pay({...}));
```
