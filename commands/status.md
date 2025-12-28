---
description: Check the status of an ACTP transaction and see available actions based on current state.
allowed-tools:
  - Read
  - Glob
  - AskUserQuestion
argument-hint: "<transaction_id>"
---

# /agirails:status

Check transaction status and see what actions are available.

## What This Command Does

1. Get transaction ID (from argument or ask)
2. Show status dashboard with current state
3. Display available actions based on state and caller role
4. Show timing information (deadline, dispute window)

## Step-by-Step Instructions

### Step 1: Get Transaction ID

If provided as argument, validate format.

If not provided, ask:
```
"Enter the transaction ID (0x...):"
```

Or offer to list recent:
```
"Show recent transactions?"
Options: [Yes - List last 5] [No - Enter ID manually]
```

### Step 2: Validate Transaction ID

Format: `0x` + 64 hexadecimal characters

If invalid:
```
"Invalid transaction ID format. Expected: 0x followed by 64 hex characters.
Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
```

### Step 3: Generate Status Code

**TypeScript:**
```typescript
const status = await client.basic.checkStatus('0x...');
console.log('State:', status.state);
console.log('Can release:', status.canRelease);
console.log('Can dispute:', status.canDispute);
console.log('Can cancel:', status.canCancel);
```

**Python:**
```python
status = await client.basic.check_status("0x...")
print(f"State: {status.state}")
print(f"Can release: {status.can_release}")
print(f"Can dispute: {status.can_dispute}")
print(f"Can cancel: {status.can_cancel}")
```

### Step 4: Display Status Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  TRANSACTION STATUS                                         │
├─────────────────────────────────────────────────────────────┤
│  ID:        0xabc123...def456                               │
│  State:     DELIVERED (awaiting release)                    │
│                                                             │
│  Progress:                                                  │
│  INITIATED → COMMITTED → DELIVERED → [ ] SETTLED            │
│      [x]        [x]         [*]                             │
│                                                             │
│  Details:                                                   │
│  Requester:    0xReq...123                                  │
│  Provider:     0xPro...456                                  │
│  Amount:       $100.00 USDC                                 │
│  Fee:          $1.00 (1%)                                   │
│                                                             │
│  Timing:                                                    │
│  Created:      2025-12-27 10:30 UTC                         │
│  Delivered:    2025-12-27 14:45 UTC                         │
│  Deadline:     2025-12-28 10:30 UTC                         │
│                                                             │
│  Dispute Window: 47h 15m remaining                          │
│  Auto-settles in: 47h 15m (if no dispute)                   │
└─────────────────────────────────────────────────────────────┘
```

### Step 5: Show Available Actions

Based on current state and caller role:

**If COMMITTED:**
```
Available Actions:
- Wait for provider to deliver
- Cancel transaction (if deadline passed): /agirails:cancel <txId>
```

**If DELIVERED:**
```
Available Actions:
- Release payment to provider
- Raise dispute if unsatisfied

Code to release:
  await client.basic.release('0x...');

Code to dispute:
  await client.basic.dispute('0x...', { reason: 'Reason here' });
```

**If SETTLED or CANCELLED:**
```
Transaction is complete. No further actions available.
```

### Step 6: State-Specific Information

**For each state, explain:**

| State | Description | Available Actions |
|-------|-------------|-------------------|
| INITIATED | Waiting for escrow | Link escrow, Cancel |
| QUOTED | Provider quoted price | Accept, Cancel |
| COMMITTED | Funds locked | Wait for delivery, Cancel (conditions apply) |
| IN_PROGRESS | Provider working | Wait for delivery |
| DELIVERED | Work complete | Release, Dispute |
| DISPUTED | Under dispute | Wait for resolution |
| SETTLED | Payment complete | None (terminal) |
| CANCELLED | Cancelled | None (terminal) |

## Output Format

Always include:
1. Current state with visual progress bar
2. Key addresses and amounts
3. Relevant timestamps
4. Available actions with code examples
5. Time remaining for any deadlines
