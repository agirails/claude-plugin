---
description: Display and explain the ACTP 8-state machine with visual diagrams and transition rules.
allowed-tools:
  - AskUserQuestion
argument-hint: "[state_name]"
---

# /agirails:states

Visualize and understand the ACTP transaction state machine.

## What This Command Does

1. Display the full 8-state machine diagram
2. Explain each state
3. Show valid transitions
4. Provide code examples for transitions

## Output

### Full State Machine Diagram

```
ACTP Transaction State Machine (8 States)
══════════════════════════════════════════════════════════════════

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

══════════════════════════════════════════════════════════════════
```

### State Summary

| State | Code | Description | Terminal |
|-------|------|-------------|----------|
| INITIATED | 0 | Transaction created, no escrow linked | No |
| QUOTED | 1 | Provider submitted price quote | No |
| COMMITTED | 2 | Escrow linked, funds locked | No |
| IN_PROGRESS | 3 | Provider actively working | No |
| DELIVERED | 4 | Work delivered with proof | No |
| SETTLED | 5 | Payment released | Yes |
| DISPUTED | 6 | Under dispute | No |
| CANCELLED | 7 | Transaction cancelled | Yes |

### Common Transaction Paths

**Happy Path (most common):**
```
INITIATED → COMMITTED → DELIVERED → SETTLED
```

**With Provider Quote:**
```
INITIATED → QUOTED → COMMITTED → DELIVERED → SETTLED
```

**With Progress Tracking:**
```
INITIATED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED
```

**Dispute Resolution:**
```
INITIATED → COMMITTED → DELIVERED → DISPUTED → SETTLED
```

**Cancellation:**
```
INITIATED → CANCELLED
COMMITTED → CANCELLED (before deadline)
```

### Transition Rules

| From | To | Caller | Method |
|------|-----|--------|--------|
| INITIATED | QUOTED | Provider | `transitionState()` |
| INITIATED | COMMITTED | Requester | `linkEscrow()` |
| INITIATED | CANCELLED | Requester | `cancel()` |
| QUOTED | COMMITTED | Requester | `linkEscrow()` |
| QUOTED | CANCELLED | Requester | `cancel()` |
| COMMITTED | IN_PROGRESS | Provider | `transitionState()` |
| COMMITTED | DELIVERED | Provider | `transitionState()` |
| COMMITTED | CANCELLED | Either | `cancel()` |
| IN_PROGRESS | DELIVERED | Provider | `transitionState()` |
| DELIVERED | SETTLED | Requester/Auto | `releaseEscrow()` |
| DELIVERED | DISPUTED | Either | `raiseDispute()` |
| DISPUTED | SETTLED | Mediator | `resolveDispute()` |

### Interactive Mode

If user provides a state name as argument, show detailed info for that state:

```
/agirails:states DELIVERED
```

Output:
```
┌─────────────────────────────────────────────────────────────────┐
│  STATE: DELIVERED (4)                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Description:                                                   │
│  Provider has completed work and submitted delivery proof.      │
│  Requester can now release payment or raise a dispute.          │
│                                                                 │
│  Entry Conditions:                                              │
│  - Previous state: COMMITTED or IN_PROGRESS                     │
│  - Caller: Provider only                                        │
│  - Optional: Delivery proof (hash + URL)                        │
│                                                                 │
│  Available Actions:                                             │
│  - Requester: releaseEscrow() → SETTLED                         │
│  - Either: raiseDispute() → DISPUTED                            │
│  - Auto: After dispute window expires → SETTLED                 │
│                                                                 │
│  Timing:                                                        │
│  - Dispute window: default 48 hours                             │
│  - If no action, auto-settles after window                      │
│                                                                 │
│  Code Example (Provider delivering):                            │
│  await client.standard.transitionState(txId, 'DELIVERED', {     │
│    resultHash: '0x...',                                         │
│    resultUrl: 'ipfs://...',                                     │
│  });                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
