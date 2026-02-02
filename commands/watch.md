---
description: Watch an ACTP transaction in real-time, showing state changes and events as they happen.
allowed-tools:
  - Read
  - Glob
  - AskUserQuestion
argument-hint: "<transaction_id>"
---

# /agirails:watch

Monitor a transaction in real-time.

## What This Command Does

1. Get transaction ID
2. Display current status
3. Generate code for real-time monitoring
4. Show expected state transitions

## Step-by-Step Instructions

### Step 1: Get Transaction ID

If provided as argument, use directly.

Otherwise, ask:
```
"Enter the transaction ID to watch:"
```

Or offer to list recent:
```
"Which transaction to watch?"
Options:
  [Enter ID manually]
  [Show my recent transactions]
  [Watch latest transaction]
```

### Step 2: Display Current Status

```
┌─────────────────────────────────────────────────────────────────┐
│  WATCHING TRANSACTION                                           │
├─────────────────────────────────────────────────────────────────┤
│  ID: 0xabc123...def456                                          │
│                                                                 │
│  Current State: COMMITTED                                       │
│  ├── Requester: 0xReq...123                                     │
│  ├── Provider:  0xPro...456                                     │
│  ├── Amount:    $100.00 USDC                                    │
│  └── Deadline:  2025-12-28 15:30 UTC (23h 45m remaining)        │
│                                                                 │
│  Progress:                                                      │
│  [✓] INITIATED → [✓] COMMITTED → [ ] IN_PROGRESS → [ ] DELIVERED → [ ] SETTLED │
│                                                                 │
│  Waiting for: Provider to start work                               │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Generate Watch Code (Polling)

**TypeScript:**
```typescript
import { ACTPClient } from '@agirails/sdk';

const TERMINAL = new Set(['SETTLED', 'CANCELLED']);

async function watchTransaction(txId: string) {
  const client = await ACTPClient.create({
    mode: 'testnet', // or 'mainnet'
    privateKey: process.env.PRIVATE_KEY,
    requesterAddress: '0xYourAddress',
  });

  let lastState = '';

  while (true) {
    const status = await client.basic.checkStatus(txId);
    if (status.state !== lastState) {
      console.log(`[${new Date().toISOString()}] ${lastState} → ${status.state}`);
      lastState = status.state;
    }

    if (TERMINAL.has(status.state)) {
      console.log('✅ Transaction complete');
      break;
    }

    // Poll every 5 seconds
    await new Promise(r => setTimeout(r, 5000));
  }
}

watchTransaction('0xYourTransactionId').catch(console.error);
```

**Python:**
```python
import asyncio
import os
from datetime import datetime
from agirails import ACTPClient

TERMINAL = {"SETTLED", "CANCELLED"}

async def watch_transaction(tx_id: str):
    client = await ACTPClient.create(
        mode="testnet",  # or 'mainnet'
        private_key=os.environ["PRIVATE_KEY"],
        requester_address=os.environ["REQUESTER_ADDRESS"],
    )

    last_state = ""
    while True:
        status = await client.basic.check_status(tx_id)
        if status.state != last_state:
            print(f"[{datetime.now().isoformat()}] {last_state} → {status.state}")
            last_state = status.state

        if status.state in TERMINAL:
            print("✅ Transaction complete")
            break

        await asyncio.sleep(5)

asyncio.run(watch_transaction("0xYourTransactionId"))
```

### Step 4: Advanced (On-Chain Events)

For real-time event streams, use your own indexer or subscribe directly to
contract events (TransactionCreated, StateTransitioned, EscrowLinked) via ethers/web3.
The SDK does not expose a high-level events API in TypeScript.

### Step 5: State-Specific Notifications

Show what to expect for each state:

| Current State | Next State | Trigger | Typical Wait |
|---------------|------------|---------|--------------|
| INITIATED | COMMITTED | Requester links escrow | Immediate |
| COMMITTED | IN_PROGRESS | Provider starts work | Minutes to hours |
| IN_PROGRESS | DELIVERED | Provider completes | Varies by service |
| DELIVERED | SETTLED | Requester releases or auto | Up to dispute window |
| DELIVERED | DISPUTED | Either party disputes | During dispute window |
| DISPUTED | SETTLED | Mediator resolves | 24-72 hours |
| DISPUTED | CANCELLED | Admin/pauser cancels | Emergency only |

### Step 6: Dashboard View (Extended)

For long-running transactions:

```
┌─────────────────────────────────────────────────────────────────┐
│  TRANSACTION TIMELINE                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  2025-12-27 10:30:00  INITIATED                                 │
│  │   Transaction created                                        │
│  │   Amount: $100.00 USDC                                       │
│  │                                                              │
│  2025-12-27 10:30:15  COMMITTED                                 │
│  │   Escrow linked, funds locked                                │
│  │   Provider: 0xPro...456                                      │
│  │                                                              │
│  2025-12-27 10:32:00  IN_PROGRESS                               │
│  │   Provider started work                                      │
│  │   "Starting code review..."                                  │
│  │                                                              │
│  2025-12-27 14:45:00  DELIVERED                                 │
│  │   Work complete                                              │
│  │   Proof: 0x1234...                                           │
│  │   URL: ipfs://Qm...                                          │
│  │                                                              │
│  ⏳ AWAITING                                                    │
│      Dispute window: 47h 15m remaining                          │
│      Action needed: Release or dispute                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Available Actions:
- Release payment: await client.standard.releaseEscrow(txId);
- Raise dispute:   await client.standard.transitionState(txId, 'DISPUTED');
- View details:    /agirails:status 0xabc123...
```

## Integration with Notifications

```typescript
// Example: Send notification when transaction completes (polling)
const interval = setInterval(async () => {
  const status = await client.basic.checkStatus(txId);
  if (status.state === 'SETTLED') {
    clearInterval(interval);
    await fetch('https://hooks.slack.com/...', {
      method: 'POST',
      body: JSON.stringify({
        text: `✅ Transaction ${txId} settled!`,
      }),
    });
  }
}, 5000);
```
