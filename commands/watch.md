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
│  [✓] INITIATED → [✓] COMMITTED → [ ] DELIVERED → [ ] SETTLED   │
│                                                                 │
│  Waiting for: Provider to deliver                               │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Generate Watch Code

**TypeScript:**
```typescript
import { ACTPClient } from '@agirails/sdk';

async function watchTransaction(txId: string) {
  const client = await ACTPClient.create({
    mode: 'testnet', // or 'mainnet'
    privateKey: process.env.PRIVATE_KEY,
  });

  console.log(`Watching transaction: ${txId}\n`);

  // Get initial status
  let status = await client.basic.checkStatus(txId);
  console.log(`Current state: ${status.state}`);

  // Watch for changes
  const unsubscribe = client.events.watchTransaction(txId, {
    onStateChange: (event) => {
      console.log(`\n🔄 State changed: ${event.fromState} → ${event.toState}`);
      console.log(`   Time: ${new Date().toISOString()}`);

      if (event.toState === 'DELIVERED') {
        console.log(`   Delivery proof: ${event.metadata?.resultHash}`);
        console.log(`   Dispute window starts now`);
      }

      if (event.toState === 'SETTLED') {
        console.log(`   ✅ Transaction complete!`);
        unsubscribe();
      }
    },
    onDeadlineApproaching: (hoursRemaining) => {
      console.log(`\n⚠️ Deadline in ${hoursRemaining} hours!`);
    },
    onDisputeWindowClosing: (hoursRemaining) => {
      console.log(`\n⏰ Dispute window closes in ${hoursRemaining} hours`);
    },
  });

  // Keep watching until terminal state
  console.log('\nWatching for changes... (Press Ctrl+C to stop)');
}

// Usage
watchTransaction('0xYourTransactionId').catch(console.error);
```

**Python:**
```python
import asyncio
from agirails import ACTPClient

async def watch_transaction(tx_id: str):
    client = await ACTPClient.create(
        mode="testnet",  # or 'mainnet'
        private_key=os.environ["PRIVATE_KEY"],
    )

    print(f"Watching transaction: {tx_id}\n")

    # Get initial status
    status = await client.basic.check_status(tx_id)
    print(f"Current state: {status.state}")

    # Watch for changes
    async def on_state_change(event):
        print(f"\n🔄 State changed: {event.from_state} → {event.to_state}")
        print(f"   Time: {datetime.now().isoformat()}")

        if event.to_state == "DELIVERED":
            print(f"   Delivery proof: {event.metadata.get('result_hash')}")
            print("   Dispute window starts now")

        if event.to_state == "SETTLED":
            print("   ✅ Transaction complete!")
            return True  # Stop watching

    await client.events.watch_transaction(
        tx_id,
        on_state_change=on_state_change,
    )

# Usage
asyncio.run(watch_transaction("0xYourTransactionId"))
```

### Step 4: Polling Alternative (Simple)

For environments without WebSocket support:

```typescript
import { ACTPClient } from '@agirails/sdk';

async function pollTransaction(txId: string) {
  const client = await ACTPClient.create({
    mode: 'testnet',
    privateKey: process.env.PRIVATE_KEY,
  });

  let lastState = '';

  while (true) {
    const status = await client.basic.checkStatus(txId);

    if (status.state !== lastState) {
      console.log(`\n[${new Date().toISOString()}]`);
      console.log(`State: ${status.state}`);

      if (status.isTerminal) {
        console.log('Transaction complete!');
        break;
      }

      lastState = status.state;
    }

    // Poll every 5 seconds
    await new Promise(r => setTimeout(r, 5000));
  }
}

pollTransaction('0xYourTransactionId').catch(console.error);
```

### Step 5: State-Specific Notifications

Show what to expect for each state:

| Current State | Next State | Trigger | Typical Wait |
|---------------|------------|---------|--------------|
| INITIATED | COMMITTED | Requester links escrow | Immediate |
| COMMITTED | IN_PROGRESS | Provider starts work | Minutes to hours |
| COMMITTED | DELIVERED | Provider completes | Varies by service |
| IN_PROGRESS | DELIVERED | Provider completes | Varies by service |
| DELIVERED | SETTLED | Requester releases or auto | Up to dispute window |
| DELIVERED | DISPUTED | Either party disputes | During dispute window |
| DISPUTED | SETTLED | Mediator resolves | 24-72 hours |

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
- Release payment: await client.basic.release(txId);
- Raise dispute:   await client.basic.dispute(txId, {...});
- View details:    /agirails:status 0xabc123...
```

## Integration with Notifications

```typescript
// Example: Send notification when transaction completes
client.events.watchTransaction(txId, {
  onStateChange: async (event) => {
    if (event.toState === 'SETTLED') {
      // Send Slack notification
      await fetch('https://hooks.slack.com/...', {
        method: 'POST',
        body: JSON.stringify({
          text: `✅ Transaction ${txId} settled! Amount: ${event.amount} USDC`,
        }),
      });
    }
  },
});
```
