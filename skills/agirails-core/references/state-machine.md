# ACTP State Machine - Complete Reference

## Visual Diagram

```
                         ┌──────────────┐
                         │  INITIATED   │ ← Transaction created
                         │    (0)       │   No escrow yet
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           │           │
             ┌──────────┐       │           │
             │  QUOTED  │       │           │
             │   (1)    │       │           │
             └────┬─────┘       │           │
                  │             │           │
                  └──────┬──────┘           │
                         │                  │
                         ▼                  │
                  ┌──────────────┐          │
                  │  COMMITTED   │ ← Escrow linked     ──────┐
                  │     (2)      │   Funds locked             │
                  └──────┬───────┘                            │
                         │                                    │
                         ▼                                    │
                  ┌──────────────┐                            │
                  │ IN_PROGRESS  │ ← Provider working         │
                  │     (3)      │   (required before DELIVERED)
                  └──────┬───────┘                            │
                         │                                    │
                         ▼                                    ▼
                  ┌──────────────┐                     ┌────────────┐
                  │  DELIVERED   │ ← Work complete     │ CANCELLED  │
                  │     (4)      │   Proof submitted   │    (7)     │
                  └──────┬───────┘                     └────────────┘
                         │                               Terminal
            ┌────────────┼────────────┐
            │                         │
            ▼                         ▼
     ┌──────────────┐          ┌──────────────┐
     │   SETTLED    │          │  DISPUTED    │
     │     (5)      │          │     (6)      │
     └──────────────┘          └──────┬───────┘
        Terminal                      │
                                      ▼
                               ┌──────────────┐
                               │   SETTLED    │
                               │  (resolved)  │
                               └──────────────┘
```

## State Definitions

### INITIATED (0)
Transaction has been created but no escrow is linked yet.

**Entry:** `createTransaction()` called
**Exit:** `linkEscrow()` → COMMITTED, or `transitionState(QUOTED)` → QUOTED, or `transitionState(CANCELLED)` → CANCELLED

**Properties:**
- Transaction ID assigned
- Requester, provider, amount, deadline set
- No funds locked
- Can be cancelled freely

### QUOTED (1)
Provider has submitted a price quote. Optional state for negotiation.

**Entry:** `transitionState(QUOTED)` from INITIATED
**Exit:** `linkEscrow()` → COMMITTED, or `transitionState(CANCELLED)` → CANCELLED

**Properties:**
- Provider has reviewed the request
- Quote may differ from original amount
- Still no funds locked

### COMMITTED (2)
Escrow is linked and funds are locked. Work can begin.

**Entry:** `linkEscrow()` from INITIATED or QUOTED
**Exit:** `transitionState(IN_PROGRESS)` → IN_PROGRESS, or `transitionState(CANCELLED)` → CANCELLED

**Properties:**
- USDC locked in escrow vault
- Provider is committed to deliver
- Deadline timer active
- Cancel still possible (with conditions)

### IN_PROGRESS (3)
Provider is actively working on the service. Required state before transitioning to DELIVERED.

**Entry:** `transitionState(IN_PROGRESS)` from COMMITTED
**Exit:** `transitionState(DELIVERED, disputeWindowProof)` → DELIVERED, or `transitionState(CANCELLED)` → CANCELLED (provider only)

**Properties:**
- Signals active work
- Useful for long-running tasks
- Provider can cancel if unable to complete
- Must progress to DELIVERED or CANCELLED

### DELIVERED (4)
Provider has completed work and submitted delivery proof.

**Entry:** `transitionState(DELIVERED, disputeWindowProof)` from IN_PROGRESS (required)
**Exit:** `releaseEscrow()` → SETTLED, or `transitionState(txId, 'DISPUTED')` → DISPUTED

**Properties:**
- Work is complete
- Proof hash/URL recorded
- Dispute window starts
- Can be settled after window expires

### SETTLED (5)
Payment has been released. Terminal state.

**Entry:** `releaseEscrow()` from DELIVERED, or `transitionState(SETTLED, resolutionProof)` from DISPUTED (admin/pauser)
**Exit:** None (terminal)

**Properties:**
- Funds transferred to provider (minus fee)
- Fee transferred to platform
- No further actions possible
- Transaction complete

### DISPUTED (6)
Transaction is under dispute, awaiting resolution.

**Entry:** `transitionState(txId, 'DISPUTED')` from DELIVERED
**Exit:** `transitionState(SETTLED, resolutionProof)` → SETTLED (admin/pauser), or `transitionState(CANCELLED)` → CANCELLED (admin/pauser)

**Properties:**
- Funds remain locked
- Mediator assigned
- Evidence submission period
- Resolution determines fund split

### CANCELLED (7)
Transaction was cancelled before completion. Terminal state.

**Entry:** `transitionState(CANCELLED)` from INITIATED, QUOTED, COMMITTED, or IN_PROGRESS (provider only)
**Exit:** None (terminal)

**Properties:**
- Funds returned to requester (if any were locked)
- No fee charged
- Transaction abandoned

## Transition Table

| From | To | Caller | Method | Conditions |
|------|-----|--------|--------|------------|
| INITIATED | QUOTED | Provider | `transitionState()` | - |
| INITIATED | COMMITTED | Requester | `linkEscrow()` | - |
| INITIATED | CANCELLED | Requester | `transitionState()` | Before deadline |
| QUOTED | COMMITTED | Requester | `linkEscrow()` | - |
| QUOTED | CANCELLED | Requester | `transitionState()` | Before deadline |
| COMMITTED | IN_PROGRESS | Provider | `transitionState()` | - |
| COMMITTED | CANCELLED | Either | `transitionState()` | Before deadline, conditions apply |
| IN_PROGRESS | DELIVERED | Provider | `transitionState()` | - |
| IN_PROGRESS | CANCELLED | Provider | `transitionState()` | Provider abandons work |
| DELIVERED | SETTLED | Requester | `releaseEscrow()` | - |
| DELIVERED | SETTLED | Auto | After dispute window | Window expired |
| DELIVERED | DISPUTED | Either | `transitionState()` | Within dispute window |
| DISPUTED | SETTLED | Admin/Pauser | `transitionState()` | Resolution provided |
| DISPUTED | CANCELLED | Admin/Pauser | `transitionState()` | Emergency only |

## Timing Constraints

### Deadline
- Set at transaction creation
- Absolute timestamp (Unix seconds)
- Transaction cannot proceed to DELIVERED after deadline
- Requester can cancel after deadline passes

```solidity
// Example: 24-hour deadline
deadline = block.timestamp + 24 hours
```

### Dispute Window
- Starts when transaction enters DELIVERED state
- Duration set at transaction creation (default: 48 hours)
- Requester can dispute during window
- Auto-settles after window expires

```solidity
// Example: 48-hour dispute window
disputeWindowEnd = deliveredAt + disputeWindow
canDispute = block.timestamp < disputeWindowEnd
```

## SDK State Checking

```typescript
// TypeScript
const tx = await client.standard.getTransaction(txId);
console.log('State:', tx.state); // 'COMMITTED'

// Check what actions are available
const status = await client.basic.checkStatus(txId);
console.log('Can accept:', status.canAccept);
console.log('Can complete:', status.canComplete);
console.log('Can dispute:', status.canDispute);
```

```python
# Python
tx = await client.standard.get_transaction(tx_id)
print(f"State: {tx.state}")  # 'COMMITTED'

# Check what actions are available
status = await client.basic.check_status(tx_id)
print(f"Can accept: {status.can_accept}")
print(f"Can complete: {status.can_complete}")
print(f"Can dispute: {status.can_dispute}")
```

## Common Patterns

### Happy Path
```
createTransaction() → INITIATED
linkEscrow() → COMMITTED
transitionState(IN_PROGRESS) → IN_PROGRESS
[provider works]
transitionState(DELIVERED, disputeWindowProof) → DELIVERED
[requester satisfied]
releaseEscrow() → SETTLED
```

### Skip QUOTED State
```
createTransaction() → INITIATED
linkEscrow() → COMMITTED (skip QUOTED)
transitionState(IN_PROGRESS) → IN_PROGRESS
transitionState(DELIVERED, disputeWindowProof) → DELIVERED
releaseEscrow() → SETTLED
```

### Dispute Flow
```
... → DELIVERED
transitionState(txId, 'DISPUTED') → DISPUTED
[mediator reviews]
// Admin/pauser resolves with a settlement proof
transitionState(txId, 'SETTLED', resolutionProof) → SETTLED
```

### Cancellation
```
createTransaction() → INITIATED
[requester changes mind]
transitionState(txId, 'CANCELLED') → CANCELLED
```

## Invalid Transitions

These transitions will revert:

- Any state → INITIATED (cannot go back to start)
- DELIVERED → COMMITTED (cannot go backwards)
- SETTLED → Any (terminal state)
- CANCELLED → Any (terminal state)
- DISPUTED → DELIVERED (must resolve)
- COMMITTED → DELIVERED (must go through IN_PROGRESS)
