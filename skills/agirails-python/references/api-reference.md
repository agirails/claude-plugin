# Python SDK API Reference

## ACTPClient

### `ACTPClient.create()`

Factory method to create a client instance.

```python
from agirails import ACTPClient

# Options
client = await ACTPClient.create(
    mode: str,                    # "mock" | "testnet" | "mainnet"
    private_key: str | None,      # Required for testnet/mainnet
    requester_address: str | None, # Required for mock mode
    rpc_url: str | None,          # Optional, has defaults
    state_directory: str | None,  # Mock mode state persistence
)
```

### Properties

```python
client.basic      # Basic API instance
client.standard   # Standard API instance
client.advanced   # Advanced API instance
client.mock       # Mock utilities (only in mock mode)
client.mode       # Current mode string
client.address    # Wallet address
```

---

## Basic API

### `client.basic.pay(options)`

Create and fund a transaction in one call.

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class PayResult:
    tx_id: str
    state: str
    amount: str
    fee: str
    deadline: datetime
    dispute_window_end: datetime

result = await client.basic.pay({
    "to": "0x...",              # Provider address
    "amount": 100.00,           # Float or string
    "deadline": "24h",          # "+1h", "+24h", "+7d", or timestamp
    "dispute_window": 172800,   # Seconds (default: 48h)
    "service_description": "...", # Optional
})

print(result.tx_id)  # "0x..."
print(result.state)  # "COMMITTED"
```

### `client.basic.check_status(tx_id)`

Get transaction status with action hints.

```python
@dataclass
class StatusResult:
    tx_id: str
    state: str
    state_code: int
    amount: str
    fee: str
    requester: str
    provider: str
    deadline: datetime
    dispute_window_end: datetime | None

    # Action hints
    can_release: bool
    can_dispute: bool
    can_cancel: bool
    is_terminal: bool

    # Formatted time remaining
    time_to_deadline: str | None
    time_to_auto_settle: str | None

status = await client.basic.check_status("0x...")
if status.can_release:
    await client.basic.release(status.tx_id)
```

### `client.basic.release(tx_id)`

Release escrowed funds to provider.

```python
await client.basic.release("0x...")
# Raises NotAuthorizedError if not requester
# Raises InvalidStateTransitionError if not DELIVERED
```

### `client.basic.dispute(tx_id, reason, evidence_url=None)`

Raise a dispute on a delivered transaction.

```python
await client.basic.dispute(
    "0x...",
    reason="Service not delivered as specified",
    evidence_url="ipfs://Qm...",
)
```

### `client.basic.cancel(tx_id)`

Cancel a transaction before DELIVERED state.

```python
await client.basic.cancel("0x...")
# Refunds escrowed amount if any
```

### `client.basic.get_balance(address=None)`

Get USDC balance.

```python
my_balance = await client.basic.get_balance()
other_balance = await client.basic.get_balance("0x...")
# Returns: "1234.56"
```

---

## Standard API

### `client.standard.create_transaction(options)`

Create transaction without funding.

```python
from decimal import Decimal

tx = await client.standard.create_transaction({
    "provider": "0x...",
    "amount": Decimal("100.000000"),  # 6 decimal places for USDC
    "deadline": 1735689600,            # Unix timestamp
    "dispute_window": 172800,          # Seconds
    "metadata": "optional",
})
# tx.state == "INITIATED"
```

### `client.standard.link_escrow(tx_id)`

Lock funds in escrow.

```python
# Approve USDC first
await client.standard.approve_usdc(amount)
# Then link
await client.standard.link_escrow("0x...")
# State transitions to COMMITTED
```

### `client.standard.transition_state(tx_id, state, metadata=None)`

Transition to new state.

```python
# Provider delivers
await client.standard.transition_state(
    "0x...",
    "DELIVERED",
    metadata={
        "result_hash": "0x...",
        "result_url": "ipfs://...",
    }
)
```

### `client.standard.get_transaction(tx_id)`

Get full transaction details.

```python
@dataclass
class Transaction:
    tx_id: str
    requester: str
    provider: str
    amount: int           # Base units (6 decimals)
    fee: int
    state: str
    state_code: int
    deadline: int         # Unix timestamp
    dispute_window: int
    created_at: int
    committed_at: int | None
    delivered_at: int | None
    settled_at: int | None
    result_hash: str | None
    result_url: str | None

tx = await client.standard.get_transaction("0x...")
```

### `client.standard.get_transactions(filter)`

Query multiple transactions.

```python
transactions = await client.standard.get_transactions({
    "requester": "0x...",        # Optional
    "provider": "0x...",         # Optional
    "participant": "0x...",      # Either requester or provider
    "states": ["COMMITTED", "DELIVERED"],
    "from_timestamp": 1735600000,
    "to_timestamp": 1735700000,
    "limit": 100,
    "offset": 0,
})
```

### Event Handlers

```python
# Define handler
async def on_state_changed(event):
    print(f"{event.tx_id}: {event.old_state} → {event.new_state}")

# Subscribe
client.standard.on("StateChanged", on_state_changed)

# Unsubscribe
client.standard.off("StateChanged", on_state_changed)

# Process events (for long-running processes)
await client.standard.process_events()
```

---

## Advanced API

### `client.advanced.kernel`

Direct access to ACTPKernel contract.

```python
kernel = client.advanced.kernel

# Read state
tx = await kernel.get_transaction("0x...")
fee = await kernel.platform_fee_bps()

# Write (requires signer)
tx_hash = await kernel.create_transaction(...)
await client.advanced.wait_for_transaction(tx_hash)
```

### `client.advanced.escrow`

Direct access to EscrowVault contract.

```python
escrow = client.advanced.escrow
balance = await escrow.get_balance("0x...")
```

### `client.advanced.usdc`

Direct access to USDC contract.

```python
usdc = client.advanced.usdc
allowance = await usdc.allowance(owner, spender)
await usdc.approve(spender, amount)
```

---

## Mock Utilities

Only available in mock mode.

```python
# Mint test USDC
await client.mock.mint("0x...", 10000)

# Fast-forward time
await client.mock.advance_time(3600)  # 1 hour

# Reset all state
await client.mock.reset()

# Set exact balance
await client.mock.set_balance("0x...", 500)
```

---

## Type Hints

```python
from agirails.types import (
    TransactionState,
    Mode,
    PayOptions,
    PayResult,
    StatusResult,
    Transaction,
)

# TransactionState is a string literal type
state: TransactionState  # "INITIATED" | "QUOTED" | "COMMITTED" | ...

# Mode is a string literal type
mode: Mode  # "mock" | "testnet" | "mainnet"
```

## Dataclasses

All result types are dataclasses with full type hints:

```python
from agirails import PayResult

result: PayResult = await client.basic.pay({...})

# IDE autocomplete works
result.tx_id    # str
result.state    # str
result.amount   # str
result.fee      # str
result.deadline # datetime
```
