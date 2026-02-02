---
description: This skill provides Python SDK reference for AGIRAILS when the user is working with Python, pyproject.toml, pip, poetry, or agirails package, or asks about Python-specific implementation details including asyncio patterns. Use this skill when writing Python code that integrates with ACTP.
---

# AGIRAILS Python SDK

Complete Python SDK reference for integrating ACTP into Python projects.

## Installation

```bash
pip install agirails
# or
poetry add agirails
# or
uv add agirails
```

**Requirements:**
- Python >= 3.9
- asyncio support

## Quick Start

```python
import asyncio
from agirails import ACTPClient

async def main():
    # Create client in mock mode
    client = await ACTPClient.create(
        mode="mock",
        requester_address="0x1234567890123456789012345678901234567890",
    )

    # Create a payment
    result = await client.basic.pay({
        "to": "0xProviderAddress",
        "amount": 100.00,
        "deadline": "24h",
    })

    print(f"Transaction ID: {result.tx_id}")
    print(f"State: {result.state}")

if __name__ == "__main__":
    asyncio.run(main())
```

## Client Initialization

### Mock Mode (Development)

```python
client = await ACTPClient.create(
    mode="mock",
    requester_address="0x...",
    state_directory=".actp",  # Optional
)
```

### Testnet Mode

```python
import os

client = await ACTPClient.create(
    mode="testnet",
    private_key=os.environ["PRIVATE_KEY"],
    rpc_url="https://sepolia.base.org",  # Optional
)
```

### Mainnet Mode

```python
client = await ACTPClient.create(
    mode="mainnet",
    private_key=os.environ["PRIVATE_KEY"],
    rpc_url=os.environ["BASE_RPC_URL"],
)
```

## Basic API Examples

### Pay for a Service

```python
result = await client.basic.pay({
    "to": "0xProviderAddress",
    "amount": 100.00,              # Float or string
    "deadline": "24h",             # Relative or absolute
    "service_description": "AI image generation",
})

# result: PayResult(tx_id, state, amount, fee, deadline)
```

### Check Status

```python
status = await client.basic.check_status(tx_id)

if status.can_release:
    await client.standard.release_escrow(tx_id)
elif status.can_dispute:
    await client.standard.transition_state(tx_id, "DISPUTED")
```

### Get Balance

```python
balance = await client.basic.get_balance()
print(f"Balance: {balance} USDC")
```

## Error Handling

```python
from agirails.errors import (
    InsufficientBalanceError,
    InvalidAddressError,
    InvalidStateTransitionError,
    TransactionNotFoundError,
    DeadlineExpiredError,
    NotAuthorizedError,
)

try:
    await client.basic.pay({...})
except InsufficientBalanceError as e:
    print(f"Need more USDC: {e.required}, have: {e.available}")
except InvalidAddressError as e:
    print(f"Bad address: {e.address}")
except InvalidStateTransitionError as e:
    print(f"Cannot transition from {e.current_state} to {e.target_state}")
```

## Asyncio Patterns

### Using with async/await

```python
import asyncio
from agirails import ACTPClient

async def process_payment():
    client = await ACTPClient.create(mode="mock", requester_address="0x...")
    result = await client.basic.pay({...})
    return result

# Run from sync context
result = asyncio.run(process_payment())
```

### Concurrent Operations

```python
import asyncio

async def monitor_transactions(tx_ids: list[str]):
    tasks = [client.basic.check_status(tx_id) for tx_id in tx_ids]
    statuses = await asyncio.gather(*tasks)
    return statuses
```

### With FastAPI

```python
from fastapi import FastAPI
from agirails import ACTPClient

app = FastAPI()
client: ACTPClient | None = None

@app.on_event("startup")
async def startup():
    global client
    client = await ACTPClient.create(mode="testnet", private_key=os.environ["PK"])

@app.post("/pay")
async def create_payment(to: str, amount: float):
    result = await client.basic.pay({"to": to, "amount": amount})
    return {"tx_id": result.tx_id, "state": result.state}
```

### Context Manager

```python
async with ACTPClient.create(mode="mock", requester_address="0x...") as client:
    result = await client.basic.pay({...})
# Client automatically cleaned up
```

## CLI Commands

The SDK includes CLI tools:

```bash
# Check balance
actp balance

# Mint test USDC (mock mode only)
actp mint 0xAddress 1000

# List transactions
actp tx list

# Get transaction status
actp tx status 0xTxId
```

## Common Mistakes

### 1. Missing `await`

```python
# WRONG - Returns coroutine, not result
result = client.basic.pay({...})
print(result)  # <coroutine object ...>

# CORRECT
result = await client.basic.pay({...})
print(result)  # PayResult(tx_id='0x...', ...)
```

### 2. Not Using asyncio.run()

```python
# WRONG - Calling async function from sync context
async def main():
    client = await ACTPClient.create(...)
    result = await client.basic.pay({...})
    return result

result = main()  # Returns coroutine, not result!

# CORRECT
result = asyncio.run(main())
```

### 3. Wrong Amount Type

```python
# BOTH WORK - SDK accepts float or string
result = await client.basic.pay({"amount": 100.00})   # Float
result = await client.basic.pay({"amount": "100.00"}) # String

# Prefer strings for precision
result = await client.basic.pay({"amount": "100.005"})
```

For detailed API reference, see `references/api-reference.md`.
For error handling patterns, see `references/error-handling.md`.
For migration from v1, see `references/migration-v1-v2.md`.
