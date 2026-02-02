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
const client = await ACTPClient.create({
  mode: 'mock',
  requesterAddress: '0xYourAddress',
});
console.log('Mode:', client.getMode());
console.log('Address:', client.getAddress());
console.log('Info:', client.info);
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
const balance = await client.getBalance(client.getAddress());
const escrowBalance = await client.standard.getEscrowBalance('0x...');
console.log('USDC Balance (wei):', balance);
console.log('Locked in Escrow:', escrowBalance);
```

### Step 4: Mode-Specific Debugging

**Mock Mode Issues:**
```
Common Mock Mode Problems:
1. "Transaction not found" - Mock state resets on restart
   Fix: Re-create transaction or persist mock state

2. "Balance is 0" - Need to mint test tokens
   Fix: await client.mintTokens('0xYourAddress', '1000000000'); // 1000 USDC (6 decimals)

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
INITIATED → Can: linkEscrow(), transitionState(CANCELLED)
QUOTED → Can: linkEscrow(), transitionState(CANCELLED)
COMMITTED → Can: transitionState(IN_PROGRESS), transitionState(CANCELLED)
IN_PROGRESS → Can: transitionState(DELIVERED, proof), transitionState(CANCELLED)
DELIVERED → Can: releaseEscrow(), transitionState(DISPUTED)
DISPUTED → Admin/Pauser: transitionState(SETTLED, resolutionProof) or transitionState(CANCELLED)
SETTLED → Terminal (no actions)
CANCELLED → Terminal (no actions)

Note: In testnet/mainnet, releaseEscrow() requires an attestation UID.
```

**State Transition Errors:**
```typescript
// Check if transition is valid
const VALID_TRANSITIONS: Record<string, string[]> = {
  INITIATED: ['QUOTED', 'COMMITTED', 'CANCELLED'],
  QUOTED: ['COMMITTED', 'CANCELLED'],
  COMMITTED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['SETTLED', 'DISPUTED'],
  DISPUTED: ['SETTLED', 'CANCELLED'],
  SETTLED: [],
  CANCELLED: [],
};

const current = await client.standard.getTransaction(txId);
const validNext = current ? (VALID_TRANSITIONS[current.state] ?? []) : [];
console.log('Current state:', current?.state);
console.log('Valid next states:', validNext);
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
│  await client.standard.transitionState('0x...', 'CANCELLED');   │
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
const tx = await client.standard.getTransaction(txId);
const now = client.advanced.time.now();

// Step 2: Determine action based on state
switch (status.state) {
  case 'COMMITTED':
    // Wait or cancel if deadline passed
    if (tx && tx.deadline <= now) {
      await client.standard.transitionState(txId, 'CANCELLED');
    }
    break;
  case 'DELIVERED':
    // Release only after dispute window
    if (tx && tx.completedAt !== null && tx.completedAt + tx.disputeWindow <= now) {
      await client.standard.releaseEscrow(txId);
    } else {
      await client.standard.transitionState(txId, 'DISPUTED');
    }
    break;
  case 'DISPUTED':
    // Wait for resolution (admin/pauser)
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
