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
                  │     (3)      │   (optional state)         │
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
**Exit:** `linkEscrow()` → COMMITTED, or `transitionState(QUOTED)` → QUOTED, or `cancel()` → CANCELLED

**Properties:**
- Transaction ID assigned
- Requester, provider, amount, deadline set
- No funds locked
- Can be cancelled freely

### QUOTED (1)
Provider has submitted a price quote. Optional state for negotiation.

**Entry:** `transitionState(QUOTED)` from INITIATED
**Exit:** `linkEscrow()` → COMMITTED, or `cancel()` → CANCELLED

**Properties:**
- Provider has reviewed the request
- Quote may differ from original amount
- Still no funds locked

### COMMITTED (2)
Escrow is linked and funds are locked. Work can begin.

**Entry:** `linkEscrow()` from INITIATED or QUOTED
**Exit:** `transitionState(DELIVERED)` → DELIVERED, or `transitionState(IN_PROGRESS)` → IN_PROGRESS, or `cancel()` → CANCELLED

**Properties:**
- USDC locked in escrow vault
- Provider is committed to deliver
- Deadline timer active
- Cancel still possible (with conditions)

### IN_PROGRESS (3)
Provider is actively working on the service. Optional state for progress tracking.

**Entry:** `transitionState(IN_PROGRESS)` from COMMITTED
**Exit:** `transitionState(DELIVERED)` → DELIVERED

**Properties:**
- Signals active work
- Useful for long-running tasks
- No cancellation from this state
- Must progress to DELIVERED

### DELIVERED (4)
Provider has completed work and submitted delivery proof.

**Entry:** `transitionState(DELIVERED)` from COMMITTED or IN_PROGRESS
**Exit:** `releaseEscrow()` → SETTLED, or `raiseDispute()` → DISPUTED

**Properties:**
- Work is complete
- Proof hash/URL recorded
- Dispute window starts
- Auto-settles after window expires

### SETTLED (5)
Payment has been released. Terminal state.

**Entry:** `releaseEscrow()` from DELIVERED, or `resolveDispute()` from DISPUTED
**Exit:** None (terminal)

**Properties:**
- Funds transferred to provider (minus fee)
- Fee transferred to platform
- No further actions possible
- Transaction complete

### DISPUTED (6)
Transaction is under dispute, awaiting resolution.

**Entry:** `raiseDispute()` from DELIVERED
**Exit:** `resolveDispute()` → SETTLED

**Properties:**
- Funds remain locked
- Mediator assigned
- Evidence submission period
- Resolution determines fund split

### CANCELLED (7)
Transaction was cancelled before completion. Terminal state.

**Entry:** `cancel()` from INITIATED, QUOTED, or COMMITTED
**Exit:** None (terminal)

**Properties:**
- Funds returned to requester (if any were locked)
- No fee charged
- Transaction abandoned

## Transition Table

| From | To | Caller | Method | Conditions |
|------|-----|--------|--------|------------|
| INITIATED | QUOTED | Provider | `transitionState()` | - |
| INITIATED | COMMITTED | Requester | `linkEscrow()` | Has USDC approval |
| INITIATED | CANCELLED | Requester | `cancel()` | Before deadline |
| QUOTED | COMMITTED | Requester | `linkEscrow()` | Has USDC approval |
| QUOTED | CANCELLED | Requester | `cancel()` | Before deadline |
| COMMITTED | IN_PROGRESS | Provider | `transitionState()` | - |
| COMMITTED | DELIVERED | Provider | `transitionState()` | - |
| COMMITTED | CANCELLED | Either | `cancel()` | Before deadline, conditions apply |
| IN_PROGRESS | DELIVERED | Provider | `transitionState()` | - |
| DELIVERED | SETTLED | Requester | `releaseEscrow()` | - |
| DELIVERED | SETTLED | Auto | After dispute window | Window expired |
| DELIVERED | DISPUTED | Either | `raiseDispute()` | Within dispute window |
| DISPUTED | SETTLED | Mediator | `resolveDispute()` | Resolution provided |

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
console.log('State code:', tx.stateCode); // 2

// Check what actions are available
const status = await client.basic.checkStatus(txId);
console.log('Can release:', status.canRelease);
console.log('Can dispute:', status.canDispute);
console.log('Can cancel:', status.canCancel);
```

```python
# Python
tx = await client.standard.get_transaction(tx_id)
print(f"State: {tx.state}")  # 'COMMITTED'
print(f"State code: {tx.state_code}")  # 2

# Check what actions are available
status = await client.basic.check_status(tx_id)
print(f"Can release: {status.can_release}")
print(f"Can dispute: {status.can_dispute}")
print(f"Can cancel: {status.can_cancel}")
```

## Common Patterns

### Happy Path
```
createTransaction() → INITIATED
linkEscrow() → COMMITTED
[provider works]
transitionState(DELIVERED) → DELIVERED
[requester satisfied]
releaseEscrow() → SETTLED
```

### Skip Optional States
```
createTransaction() → INITIATED
linkEscrow() → COMMITTED (skip QUOTED)
transitionState(DELIVERED) → DELIVERED (skip IN_PROGRESS)
releaseEscrow() → SETTLED
```

### Dispute Flow
```
... → DELIVERED
raiseDispute() → DISPUTED
[mediator reviews]
resolveDispute({
  requesterAmount: 70%,
  providerAmount: 30%
}) → SETTLED
```

### Cancellation
```
createTransaction() → INITIATED
[requester changes mind]
cancel() → CANCELLED
```

## Invalid Transitions

These transitions will revert:

- Any state → INITIATED (cannot go back to start)
- DELIVERED → COMMITTED (cannot go backwards)
- SETTLED → Any (terminal state)
- CANCELLED → Any (terminal state)
- DISPUTED → DELIVERED (must resolve)
- IN_PROGRESS → CANCELLED (must deliver or dispute)
