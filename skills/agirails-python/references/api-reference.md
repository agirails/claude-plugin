# Python SDK API Reference

## ACTPClient

### `ACTPClient.create()`

Factory method to create a client instance.

```python
from agirails import ACTPClient

client = await ACTPClient.create(
    mode="mock",                          # "mock" | "testnet" | "mainnet"
    requester_address="0x123...",         # Required - your Ethereum address
    state_directory="/path/to/state",     # Optional - mock state persistence
    private_key="0x...",                  # Required for testnet/mainnet
    rpc_url="https://...",                # Optional, has defaults
)
```

### Properties

```python
client.basic      # BasicAdapter - simple payment methods
client.standard   # StandardAdapter - explicit lifecycle control
client.runtime    # IACTPRuntime - direct protocol access
client.info       # ACTPClientInfo - mode, address, etc.
```

### Instance Methods

```python
# Get the requester address (normalized to lowercase)
client.get_address() -> str

# Get the current mode
client.get_mode() -> Literal["mock", "testnet", "mainnet"]

# Reset mock state (mock mode only)
await client.reset() -> None

# Mint test USDC (mock mode only)
await client.mint_tokens(address: str, amount: str) -> None

# Get USDC balance (mock mode only - returns wei units)
await client.get_balance(address: str) -> str
```

---

## Basic API (`client.basic`)

High-level, opinionated API for simple use cases.

### `client.basic.pay(params)`

Create and fund a transaction in one call. Auto-transitions to COMMITTED.

```python
from agirails import BasicPayParams, BasicPayResult

# Pay using a dict
result = await client.basic.pay({
    "to": "0xProvider...",
    "amount": 100.00,       # Float, int, or string
    "deadline": "+24h",     # "+1h", "+24h", "+7d", or Unix timestamp
    "dispute_window": 172800,  # Seconds (default: 2 days)
})

# Result is a dataclass
print(result.tx_id)      # "0x..."
print(result.state)      # "COMMITTED"
print(result.amount)     # "100.00 USDC"
print(result.deadline)   # ISO 8601 string
```

### `client.basic.check_status(tx_id)`

Get transaction status with action hints.

```python
from agirails import CheckStatusResult

status = await client.basic.check_status("0x...")

print(status.state)        # Current state name
print(status.can_accept)   # Provider can accept (INITIATED, before deadline)
print(status.can_complete) # Provider can deliver (COMMITTED or IN_PROGRESS)
print(status.can_dispute)  # Can dispute (DELIVERED, within dispute window)
```

---

## Standard API (`client.standard`)

Explicit lifecycle control with more flexibility.

### `client.standard.create_transaction(params)`

Create transaction without funding (INITIATED state).

```python
from agirails import StandardTransactionParams

tx_id = await client.standard.create_transaction({
    "provider": "0xProvider...",
    "amount": 100,              # User-friendly format
    "deadline": "+7d",          # Defaults to +24h
    "dispute_window": 172800,   # Defaults to 2 days
    "service_description": "Optional description",
})
# Returns transaction ID, state is INITIATED
```

### `client.standard.link_escrow(tx_id)`

Lock funds in escrow. Auto-transitions INITIATED/QUOTED → COMMITTED.

```python
escrow_id = await client.standard.link_escrow("0x...")
# State is now COMMITTED
```

### `client.standard.transition_state(tx_id, new_state)`

Transition to a new state.

```python
from agirails import TransactionState

# Provider marks work as delivered
await client.standard.transition_state(tx_id, "DELIVERED")

# Valid transitions:
# INITIATED → QUOTED, COMMITTED, CANCELLED
# QUOTED → COMMITTED, CANCELLED
# COMMITTED → IN_PROGRESS, DELIVERED, CANCELLED
# IN_PROGRESS → DELIVERED, CANCELLED
# DELIVERED → SETTLED, DISPUTED
# DISPUTED → SETTLED
```

### `client.standard.release_escrow(escrow_id, attestation_params=None)`

Release escrowed funds to provider.

```python
# Mock mode - no attestation required
await client.standard.release_escrow(escrow_id)

# Testnet/Mainnet - attestation REQUIRED
await client.standard.release_escrow(escrow_id, {
    "tx_id": "0x...",
    "attestation_uid": "0x...",
})
```

### `client.standard.get_escrow_balance(escrow_id)`

Get formatted escrow balance.

```python
balance = await client.standard.get_escrow_balance("0x...")
print(balance)  # "100.00 USDC"
```

### `client.standard.get_transaction(tx_id)`

Get full transaction details.

```python
tx = await client.standard.get_transaction("0x...")
# Returns MockTransaction | None
```

---

## Advanced API (`client.runtime`)

Direct access to the underlying runtime (IACTPRuntime).

```python
runtime = client.runtime

# Create transaction with protocol-level params
tx_id = await runtime.create_transaction({
    "provider": "0x...",
    "requester": "0x...",
    "amount": "100000000",  # wei (USDC has 6 decimals)
    "deadline": 1735574400,  # Unix timestamp
    "dispute_window": 172800,
})

# Get transaction
tx = await runtime.get_transaction(tx_id)

# State transitions
await runtime.transition_state(tx_id, "DELIVERED")

# Escrow operations
await runtime.link_escrow(tx_id, amount)
await runtime.release_escrow(escrow_id)
balance = await runtime.get_escrow_balance(escrow_id)

# Time interface (mock mode)
now = runtime.time.now()
```

---

## Level 0 API - Provider/Request Primitives

Simple provide/request interface for service discovery.

```python
from agirails import provide, request, ServiceDirectory

# Register as a provider
cleanup = await provide(
    service="image-generation",
    endpoint="https://my-agent.com/generate",
    price="10.00",
)

# Request a service
result = await request(
    service="image-generation",
    input={"prompt": "A sunset over mountains"},
    max_price="15.00",
)

# Query service directory
providers = await ServiceDirectory.find(
    service="image-generation",
    max_price="20.00",
)
```

---

## Level 1 API - Agent Abstraction

Higher-level Agent class for autonomous operation.

```python
from agirails import Agent, calculate_price

agent = Agent(
    name="my-image-agent",
    services=[{
        "name": "generate",
        "handler": generate_image,
        "pricing": {
            "base": "5.00",
            "per_unit": "0.10",
            "unit": "image",
        },
    }],
)

await agent.start()
```

---

## Error Types

### Error Hierarchy

```
ACTPError (base)
├── Transaction Errors
│   ├── TransactionError (base)
│   ├── TransactionNotFoundError
│   ├── InvalidStateTransitionError
│   ├── EscrowError (base)
│   ├── EscrowNotFoundError
│   ├── DeadlinePassedError
│   ├── DeadlineExpiredError
│   ├── DisputeWindowActiveError
│   ├── ContractPausedError
│   └── InsufficientBalanceError
├── Validation Errors
│   ├── ValidationError
│   ├── InvalidAddressError
│   └── InvalidAmountError
├── Network Errors
│   ├── NetworkError
│   ├── TransactionRevertedError
│   └── SignatureVerificationError
├── Storage Errors
│   ├── StorageError
│   ├── InvalidCIDError
│   ├── UploadTimeoutError
│   ├── DownloadTimeoutError
│   ├── FileSizeLimitExceededError
│   ├── StorageAuthenticationError
│   ├── StorageRateLimitError
│   └── ContentNotFoundError
├── Agent/Job Errors
│   ├── NoProviderFoundError
│   ├── ACTPTimeoutError
│   ├── ProviderRejectedError
│   ├── DeliveryFailedError
│   ├── DisputeRaisedError
│   ├── ServiceConfigError
│   ├── AgentLifecycleError
│   └── QueryCapExceededError
├── Mock Errors
│   ├── MockStateCorruptedError
│   ├── MockStateVersionError
│   └── MockStateLockError
└── (all have: code, message, details)
```

### Core Errors

```python
from agirails import (
    # Base
    ACTPError,                    # Base exception class

    # Transaction
    TransactionNotFoundError,     # Transaction ID not found
    InvalidStateTransitionError,  # Invalid state change
    EscrowNotFoundError,          # Escrow ID not found
    DeadlinePassedError,          # Deadline has passed
    DeadlineExpiredError,         # Alias for DeadlinePassedError
    DisputeWindowActiveError,     # Cannot finalize during dispute window
    ContractPausedError,          # Contract is paused
    InsufficientBalanceError,     # Not enough USDC

    # Validation
    ValidationError,              # Input validation failed
    InvalidAddressError,          # Bad Ethereum address
    InvalidAmountError,           # Invalid amount format

    # Network
    NetworkError,                 # RPC/network issues
    TransactionRevertedError,     # Blockchain tx reverted
    SignatureVerificationError,   # Signature mismatch
)
```

### Storage Errors (IPFS/Arweave)

```python
from agirails import (
    StorageError,                 # Base storage error
    InvalidCIDError,              # Invalid IPFS CID format
    UploadTimeoutError,           # Upload timed out
    DownloadTimeoutError,         # Download timed out
    FileSizeLimitExceededError,   # File exceeds size limit
    StorageAuthenticationError,   # Auth failed
    StorageRateLimitError,        # Rate limit exceeded
    ContentNotFoundError,         # CID not found
)
```

### Agent/Job Errors (Level 0/1 API)

```python
from agirails import (
    NoProviderFoundError,         # No provider for service
    ACTPTimeoutError,             # Operation timeout (renamed to avoid conflict)
    ProviderRejectedError,        # Provider refused job
    DeliveryFailedError,          # Delivery failed
    DisputeRaisedError,           # Dispute was raised
    ServiceConfigError,           # Bad service config
    AgentLifecycleError,          # Invalid lifecycle operation
    QueryCapExceededError,        # Registry too large
)
```

### Mock-Specific Errors

```python
from agirails import (
    MockStateCorruptedError,      # Mock state file corrupted
    MockStateVersionError,        # State version mismatch
    MockStateLockError,           # State file locked
)
```

### Error Handling Example

```python
from agirails import (
    ACTPError,
    InsufficientBalanceError,
    InvalidStateTransitionError,
    NetworkError,
)

try:
    await client.basic.pay({"to": "0x...", "amount": 100})
except InsufficientBalanceError as e:
    print(f"Need more USDC: {e.details}")
    # {'required': '100000000', 'available': '50000000'}
except InvalidStateTransitionError as e:
    print(f"Invalid transition: {e.details}")
    # {'from': 'SETTLED', 'to': 'DELIVERED', 'valid_transitions': []}
except NetworkError as e:
    print(f"Network issue: {e}")
    # Retry with exponential backoff
except ACTPError as e:
    print(f"ACTP Error [{e.code}]: {e}")
```

### Error Properties

All exceptions extending `ACTPError` have:

```python
class ACTPError(Exception):
    code: str       # Machine-readable code (e.g., 'INSUFFICIENT_BALANCE')
    message: str    # Human-readable description
    details: dict   # Additional context
```

### Debug Mode

Enable detailed error output:

```python
from agirails import set_debug_mode, is_debug_mode

set_debug_mode(True)  # Enable verbose error messages
print(is_debug_mode())  # Check current mode
```

---

## Types

```python
from agirails import TransactionState, ACTPClientMode

# TransactionState values
state: TransactionState  # Literal type
# "INITIATED" | "QUOTED" | "COMMITTED" | "IN_PROGRESS"
# | "DELIVERED" | "SETTLED" | "DISPUTED" | "CANCELLED"

# ACTPClientMode values
mode: ACTPClientMode  # Literal["mock", "testnet", "mainnet"]
```

## Dataclasses

All result types are dataclasses with full type hints:

```python
from agirails import BasicPayResult, CheckStatusResult

result: BasicPayResult = await client.basic.pay({...})

# IDE autocomplete works
result.tx_id      # str
result.state      # str
result.amount     # str
result.deadline   # str (ISO 8601)
```
