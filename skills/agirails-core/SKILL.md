---
description: This skill provides knowledge about the ACTP (Agent Commerce Transaction Protocol) when the user discusses AGIRAILS, ACTP protocol, transaction states, escrow mechanics, disputes, state machine, or protocol invariants. Use this skill when implementing payment flows, debugging state transitions, or understanding the protocol's guarantees.
---

# ACTP Protocol Core

The Agent Commerce Transaction Protocol (ACTP) is a blockchain-based payment protocol designed for AI agent commerce. It provides trustless escrow, bilateral dispute resolution, and deterministic state transitions.

## Protocol Overview

ACTP enables AI agents to pay each other for services with guaranteed delivery or refund. The protocol runs on Base (Ethereum L2) using USDC stablecoin.

**Key Properties:**
- Trustless escrow (funds locked until delivery)
- 8-state deterministic state machine
- Bilateral dispute resolution
- 1% platform fee with $0.05 minimum
- Immutable on-chain settlement

## 8-State Machine

Transactions progress through 8 states. States only move forward - never backwards.

```
INITIATED → QUOTED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED
     ↓          ↓          ↓                         ↓
     └──────────┴──────────┴── CANCELLED             └── DISPUTED → SETTLED
```

| State | Code | Description |
|-------|------|-------------|
| INITIATED | 0 | Transaction created, no escrow linked |
| QUOTED | 1 | Provider submitted price quote (optional) |
| COMMITTED | 2 | Escrow linked, funds locked |
| IN_PROGRESS | 3 | Provider actively working (required before DELIVERED) |
| DELIVERED | 4 | Work complete, proof submitted |
| SETTLED | 5 | Payment released (terminal) |
| DISPUTED | 6 | Under dispute, awaiting resolution |
| CANCELLED | 7 | Cancelled before completion (terminal) |

**Common Paths:**
- Happy path: `INITIATED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED`
- With quote: `INITIATED → QUOTED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED`
- Dispute: `INITIATED → COMMITTED → IN_PROGRESS → DELIVERED → DISPUTED → SETTLED`
- Cancel: `INITIATED → CANCELLED` or `COMMITTED → CANCELLED`

For complete state transition rules, see `references/state-machine.md`.

## Fee Structure

ACTP uses a simple fee model:

```
Fee = max(amount × 1%, $0.05)
```

| Transaction | Calculation | Fee |
|-------------|-------------|-----|
| $1.00 | max($0.01, $0.05) | $0.05 |
| $5.00 | max($0.05, $0.05) | $0.05 |
| $10.00 | max($0.10, $0.05) | $0.10 |
| $100.00 | max($1.00, $0.05) | $1.00 |

The fee is deducted from the escrowed amount when funds are released to the provider.

## Core Invariants

The protocol guarantees 10 invariants that must hold at all times:

1. **Escrow Solvency** - Vault balance ≥ sum of all active transaction amounts
2. **State Monotonicity** - States only transition forward, never backwards
3. **Fee Bounds** - Platform fee never exceeds 5% cap
4. **Deadline Enforcement** - Transactions cannot proceed after deadline
5. **Access Control** - Only authorized parties can trigger transitions
6. **Dispute Window** - Funds cannot finalize during active dispute window
7. **Pause Effectiveness** - All transitions blocked when paused
8. **Economic Delays** - Fee changes require 2-day timelock
9. **Transaction Uniqueness** - Each ID maps to exactly one transaction
10. **Fund Conservation** - Total USDC in = Total USDC out

For detailed invariant specifications with code examples, see `references/invariants.md`.

## Key Timing Rules

**Deadline:** Maximum time for provider to deliver. If deadline passes before DELIVERED state, requester can cancel.

**Dispute Window:** Time after DELIVERED state during which requester can raise dispute. Default is 48 hours. After window expires, funds auto-release to provider.

```
Transaction Created
        │
        ▼
   ┌─────────┐
   │COMMITTED│ ─── deadline ──────► Can be cancelled
   └────┬────┘
        │
        ▼ (provider delivers)
   ┌─────────┐
   │DELIVERED│ ─── dispute window ──► Auto-settles
   └────┬────┘
        │
        ▼ (release or dispute)
   ┌─────────┐
   │ SETTLED │
   └─────────┘
```

## Access Control

Each state transition has specific authorization:

| Action | Who Can Call |
|--------|--------------|
| Create transaction | Anyone (becomes requester) |
| Link escrow | Requester only |
| Quote | Provider only |
| Transition to IN_PROGRESS | Provider only |
| Transition to DELIVERED | Provider only |
| Release escrow | Requester or auto after window |
| Raise dispute | Requester or Provider |
| Resolve dispute | Mediator only |
| Cancel | Requester (before DELIVERED) |

## SDK Integration Points

When integrating ACTP:

**Requester Flow (paying for service):**
```
1. Create transaction with provider address, amount, deadline
2. Link escrow (locks USDC)
3. Wait for delivery
4. Release payment or raise dispute
```

**Provider Flow (receiving payment):**
```
1. Watch for transactions addressed to you
2. Transition to IN_PROGRESS when starting work
3. Complete work and transition to DELIVERED
4. Wait for settlement
```

## Error Handling

Common protocol errors to handle:

| Error | Cause | Resolution |
|-------|-------|------------|
| InvalidStateTransition | Wrong current state | Check state before transition |
| DeadlineExpired | Past deadline | Create new transaction |
| InsufficientBalance | Not enough USDC | Fund wallet or mint in mock |
| NotAuthorized | Wrong caller | Use correct account |
| DisputeWindowActive | Too early to finalize | Wait for window to close |

## Related Resources

- State machine details: `references/state-machine.md`
- Invariant specifications: `references/invariants.md`
- SDK patterns: See `agirails-typescript` or `agirails-python` skills
- Security checklist: See `agirails-security` skill
