---
description: This skill provides Python SDK reference for AGIRAILS v3.0.0 when the user is working with Python, pyproject.toml, pip, poetry, or agirails package, or asks about Python-specific implementation details including asyncio patterns. Use this skill when writing Python code that integrates with ACTP (Agent Commerce Transaction Protocol) — escrow payments, x402 instant payments, ERC-8004 identity, adapter routing, or agent lifecycle.
---

# AGIRAILS Python SDK v3.0.0

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

---

## Quick Start

```python
import asyncio
from agirails import ACTPClient

async def main():
    # Keystore auto-detect (recommended)
    # SDK checks: ACTP_PRIVATE_KEY env -> .actp/keystore.json + ACTP_KEY_PASSWORD
    client = await ACTPClient.create(mode="testnet")

    # Create a payment
    result = await client.basic.pay({
        "to": "0xProviderAddress",
        "amount": "100.00",
        "deadline": "24h",
    })

    print(f"Transaction ID: {result.tx_id}")
    print(f"State: {result.state}")

if __name__ == "__main__":
    asyncio.run(main())
```

---

## API Levels

The SDK provides three abstraction levels. Use the simplest one that fits your needs.

### Level 0 -- One-Liners (provide / request)

The simplest API. Single function call, SDK handles everything:

```python
from agirails import provide, request

# Provider: decorator to start earning
@provide('code-review')
async def handle(job):
    result = await review_code(job.payload)
    return {"output": result, "confidence": 0.95}

# Requester: one-liner to pay and get result
result = await request('code-review',
    payload={"repo": "https://github.com/user/repo", "pr": 42},
    max_budget=5.00,
)
```

### Level 1 -- Agent Class (multiple services, lifecycle)

For agents that provide and/or request multiple services:

```python
from agirails import Agent

agent = Agent('my-code-reviewer',
    capabilities=['code-review', 'bug-fixing'],
    pricing={'model': 'per-task', 'base': 2.00},
)

# As provider
@agent.provide('code-review')
async def handle(job):
    result = await review_code(job.payload)
    return {"output": result, "confidence": 0.95}

# As requester
result = await agent.request('bug-fixing', {
    "input": {"code": "..."},
    "budget": 10.00,
})

await agent.start()  # begins listening
```

### Level 2 -- ACTPClient (full control)

Direct access to escrow, state transitions, proofs:

```python
from agirails import ACTPClient

client = await ACTPClient.create(mode="mainnet")

# Create transaction
tx_id = await client.standard.create_transaction({
    "provider": "0xProviderAddress",
    "amount": "100",
    "deadline": int(time.time()) + 86400,
    "dispute_window": 172800,
    "service_description": "Translate 500 words to Spanish",
})

# Lock funds in escrow
escrow_id = await client.standard.link_escrow(tx_id)

# Wait for delivery... then release
await client.standard.release_escrow(escrow_id)
```

---

## Client Initialization

### Keystore Auto-Detect (Recommended)

The SDK auto-detects your wallet: checks `ACTP_PRIVATE_KEY` env var first, then falls back to `.actp/keystore.json` decrypted with `ACTP_KEY_PASSWORD`.

```python
# Keystore auto-detect -- no explicit key needed
client = await ACTPClient.create(mode="testnet")
```

### Explicit BYOW (Bring Your Own Wallet)

```python
import os

client = await ACTPClient.create(
    mode="testnet",
    private_key=os.environ["ACTP_PRIVATE_KEY"],
)
```

### Auto-Wallet (Tier 1: Smart Wallet + micro-airdrop gas)

```python
client = await ACTPClient.create(
    mode="testnet",
    wallet="auto",
)
```

Tier 1 auto-wallet creates an encrypted keystore + ERC-4337 Smart Wallet with gasless transactions (via paymaster). This is the default for 90% of agents.

### Mock Mode (Development)

```python
client = await ACTPClient.create(
    mode="mock",
    state_directory=".actp",  # Optional
)
await client.mint_tokens("0x...", "1000000000")  # Mint test USDC
```

### Mainnet Mode

```python
client = await ACTPClient.create(
    mode="mainnet",  # auto-detects keystore or ACTP_PRIVATE_KEY
)
```

### Three-Tier Wallet Architecture (AIP-12)

| Tier | Method | Use Case |
|------|--------|----------|
| Tier 1 (Auto) | `wallet="auto"` | Local encrypted key + Smart Wallet + micro-airdrop gas (default, 90%) |
| Tier 2 (BYOW) | `private_key="0x..."` | Developer's own signer/key (backward compat) |
| Tier 3 (CDP TEE) | Enterprise config | AWS Nitro Enclave + Paymaster (enterprise only) |

---

## x402 Instant Payments

For simple API calls with no deliverables or disputes -- atomic, one-step:

```python
from agirails import ACTPClient, X402Adapter

client = await ACTPClient.create(mode="mainnet")

# Register x402 adapter (not registered by default)
client.register_adapter(X402Adapter(await client.get_address(), {
    "expected_network": "base-sepolia",  # or "base-mainnet"
    "transfer_fn": transfer_usdc,  # async fn(to, amount) -> tx_hash
}))

# Pay via URL (auto-routes to x402)
await client.pay('https://provider.example.com/api/endpoint', amount=0.50)

# Or via client.basic.pay
result = await client.basic.pay({
    "to": "https://api.provider.com/service",  # HTTPS endpoint that returns 402
    "amount": "5.00",
})

print(result.response.status)  # 200
print(result.fee)              # { grossAmount, providerNet, platformFee, feeBps }
# No release() needed -- x402 is atomic (instant settlement)
```

**X402Relay contracts:**
- Sepolia: `0x4DCD02b276Dbeab57c265B72435e90507b6Ac81A`
- Mainnet: `0x81DFb954A3D58FEc24Fc9c946aC2C71a911609F8`

> **ACTP vs x402 -- when to use which?**
>
> | | ACTP (escrow) | x402 (instant) |
> |---|---|---|
> | **Use for** | Complex jobs -- code review, audits, translations | Simple API calls -- lookups, queries, one-shot requests |
> | **Payment flow** | Lock USDC -> work -> deliver -> dispute window -> settle | Pay -> get response (atomic, one step) |
> | **Dispute protection** | Yes -- 48h window, on-chain evidence | No -- payment is final |
> | **Analogy** | Hiring a contractor | Buying from a vending machine |

---

## Adapter Routing

The SDK uses an adapter router. By default, only ACTP adapters (basic + standard) are registered:

| `to` value | Adapter | Registration |
|------------|---------|--------------|
| `0x1234...` (address) | ACTP (basic/standard) | Default, always available |
| `https://...` (URL) | x402 | Must register `X402Adapter` |
| agent ID (number) | ERC-8004 | Must configure ERC-8004 bridge |

```python
# ACTP -- works out of the box (default adapters)
await client.basic.pay({"to": "0xProviderAddress", "amount": "5"})

# x402 -- requires registering the adapter first
from agirails import X402Adapter
client.register_adapter(X402Adapter(await client.get_address(), {
    "expected_network": "base-sepolia",  # or "base-mainnet"
    "transfer_fn": transfer_usdc,  # async fn(to, amount) -> tx_hash
}))
await client.basic.pay({"to": "https://api.provider.com/service", "amount": "1"})

# ERC-8004 -- requires bridge configuration
from agirails.erc8004 import ERC8004Bridge
identity = ERC8004Bridge(provider, signer)
profile = await identity.resolve(agent_id)
await client.basic.pay({"to": profile.owner, "amount": "5", "erc8004_agent_id": agent_id})
```

---

## Identity (ERC-8004)

On-chain portable identity for agents. Replaces the deprecated DID:ethr system.

```python
from agirails.erc8004 import ERC8004Bridge

identity = ERC8004Bridge(provider, signer)

# Register identity
await identity.register(name="my-agent", capabilities=["code-review"])

# Resolve agent
profile = await identity.resolve(agent_id)
print(profile.name)         # 'my-agent'
print(profile.wallet)       # payment address
print(profile.capabilities) # ['code-review']
```

**ERC-8004 Registries (canonical CREATE2, same address all chains):**

| Registry | Mainnet | Testnet |
|----------|---------|---------|
| Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### Reputation Reporting

```python
from agirails import ReputationReporter

reporter = ReputationReporter(network="base-sepolia", signer=signer)
await reporter.report_settlement(
    agent_id="12345",
    tx_id="0x...",
    capability="code_review",
)
```

Identity registration is **optional**. Neither `actp init` nor `agent.start()` registers identity automatically.

---

## Pricing

Set your price. Negotiate via the QUOTED state.

```python
agent.provide({
    "name": "translation",
    "pricing": {
        "cost": {
            "base": 0.50,                               # $0.50 fixed cost per job
            "per_unit": {"unit": "word", "rate": 0.005}, # $0.005 per word
        },
        "margin": 0.40,  # 40% profit margin
        "minimum": 1.00,  # never accept less than $1
    },
}, handler)
```

**How it works:**
- SDK calculates: `price = cost / (1 - margin)`
- If job budget >= price: **accept**
- If job budget < price but > cost: **counter-offer** (via QUOTED state)
- If job budget < cost: **reject**

**Fee:** `max(amount * 1%, $0.05)` -- auto-deducted on settlement. Same fee on both ACTP and x402 paths. No subscriptions, no hidden costs.

Provider receives: `amount - max(amount * 0.01, $0.05)`

---

## State Machine

```
INITIATED --+-> QUOTED --> COMMITTED --> IN_PROGRESS --> DELIVERED --> SETTLED
            |                  |              |              |
            +--> COMMITTED     |              |              +--> DISPUTED
                               |              |                    |    |
                               v              v                    v    v
                           CANCELLED      CANCELLED            SETTLED  CANCELLED

Any of INITIATED, QUOTED, COMMITTED, IN_PROGRESS can -> CANCELLED
Only DELIVERED can -> DISPUTED
SETTLED and CANCELLED are terminal (no outbound transitions)
```

**Valid transitions:**

| From | To |
|------|-----|
| INITIATED | QUOTED, COMMITTED, CANCELLED |
| QUOTED | COMMITTED, CANCELLED |
| COMMITTED | IN_PROGRESS, CANCELLED |
| IN_PROGRESS | DELIVERED, CANCELLED |
| DELIVERED | SETTLED, DISPUTED |
| DISPUTED | SETTLED, CANCELLED |
| SETTLED | *(terminal)* |
| CANCELLED | *(terminal)* |

Note: INITIATED can go directly to COMMITTED (skipping QUOTED) per AIP-3.

---

## Basic API Examples

### Pay for a Service

```python
result = await client.basic.pay({
    "to": "0xProviderAddress",
    "amount": "100.00",     # String or float
    "deadline": "24h",      # Relative or absolute
})

# result: PayResult(tx_id, state, amount, deadline)
```

### Check Status

```python
status = await client.basic.check_status(tx_id)

if status.can_dispute:
    await client.standard.transition_state(tx_id, "DISPUTED")
```

### Get Balance

```python
balance = await client.basic.get_balance()
print(f"Balance: {balance} USDC")
```

---

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
except DeadlineExpiredError:
    print("Deadline has passed, create a new transaction")
except TransactionNotFoundError as e:
    print(f"Transaction not found: {e.tx_id}")
except NotAuthorizedError:
    print("Not authorized for this action")
```

---

## Asyncio Patterns

### Using with async/await

```python
import asyncio
from agirails import ACTPClient

async def process_payment():
    client = await ACTPClient.create(mode="testnet")
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
import os
from fastapi import FastAPI
from agirails import ACTPClient

app = FastAPI()
client: ACTPClient | None = None

@app.on_event("startup")
async def startup():
    global client
    # Keystore auto-detect -- no explicit key needed
    client = await ACTPClient.create(mode="mainnet")

@app.post("/pay")
async def create_payment(to: str, amount: float):
    result = await client.basic.pay({"to": to, "amount": str(amount)})
    return {"tx_id": result.tx_id, "state": result.state}
```

### Context Manager

```python
async with ACTPClient.create(mode="testnet") as client:
    result = await client.basic.pay({...})
# Client automatically cleaned up
```

---

## x402 Fee Splitting

Both ACTP (escrow) and x402 (instant) payments carry the same 1% platform fee ($0.05 minimum).

For x402 payments, fees are split atomically on-chain via the `X402Relay` contract:
- Provider receives 99% (or gross minus $0.05 minimum)
- Treasury receives 1% fee
- Single transaction -- no partial failure risk

```python
result = await client.basic.pay({
    "to": "https://api.provider.com/service",
    "amount": "100.00",
})

print(result.fee_breakdown)
# { "grossAmount": "100000000", "providerNet": "99000000",
#   "platformFee": "1000000", "feeBps": 100, "estimated": True }
```

---

## Config Management (AGIRAILS.md as Source of Truth)

Publish your agent's config hash on-chain for verifiable config management:

```bash
actp publish          # Hash AGIRAILS.md -> store configHash + configCID in AgentRegistry
actp diff             # Compare local AGIRAILS.md hash vs on-chain -- detect drift
actp pull             # Restore AGIRAILS.md from on-chain configCID (IPFS)
```

This enables:
- **Verifiable config**: anyone can verify your agent's stated capabilities match on-chain
- **Drift detection**: SDK checks config hash on startup (non-blocking warning if mismatch)
- **Recovery**: restore your config from on-chain if local file is lost

---

## CLI Reference

The SDK includes 24 CLI commands:

**Project:**

| Command | Description |
|---------|-------------|
| `actp init` | Initialize ACTP in current directory |
| `actp init --scaffold` | Generate starter agent file (use `--intent earn/pay/both`) |

**Payments:**

| Command | Description |
|---------|-------------|
| `actp pay <to> <amount>` | Create a payment transaction |
| `actp balance [address]` | Check USDC balance |

**Transaction Lifecycle:**

| Command | Description |
|---------|-------------|
| `actp tx create` | Create transaction (advanced) |
| `actp tx status <txId>` | Check transaction state |
| `actp tx list` | List all transactions |
| `actp tx deliver <txId>` | Mark transaction as delivered |
| `actp tx settle <txId>` | Release escrow funds |
| `actp tx cancel <txId>` | Cancel a transaction |

**Monitor:**

| Command | Description |
|---------|-------------|
| `actp watch <txId>` | Watch transaction state changes |

**Simulate:**

| Command | Description |
|---------|-------------|
| `actp simulate pay` | Dry-run a payment |
| `actp simulate fee <amount>` | Calculate fee for amount |

**Batch:**

| Command | Description |
|---------|-------------|
| `actp batch [file]` | Execute batch commands from file |

**Token:**

| Command | Description |
|---------|-------------|
| `actp mint <address> <amount>` | Mint test USDC (mock only) |

**Config:**

| Command | Description |
|---------|-------------|
| `actp config show` | View current configuration |
| `actp config set <key> <value>` | Set configuration value |
| `actp config get <key>` | Get configuration value |

**AGIRAILS.md:**

| Command | Description |
|---------|-------------|
| `actp publish` | Publish AGIRAILS.md config hash to on-chain AgentRegistry |
| `actp pull` | Restore AGIRAILS.md from on-chain config (via configCID) |
| `actp diff` | Compare local config vs on-chain snapshot |

**Time (mock mode):**

| Command | Description |
|---------|-------------|
| `actp time show` | Show mock blockchain time |
| `actp time advance <duration>` | Advance mock time |
| `actp time set <timestamp>` | Set mock time |

All commands support `--json` for machine-readable output and `-q`/`--quiet` for minimal output.

---

## Contract Addresses

### Testnet (Base Sepolia, chainId 84532)

| Contract | Address |
|----------|---------|
| ACTPKernel | `0x469CBADbACFFE096270594F0a31f0EEC53753411` |
| EscrowVault | `0x57f888261b629bB380dfb983f5DA6c70Ff2D49E5` |
| MockUSDC | `0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb` |
| X402Relay | `0x4DCD02b276Dbeab57c265B72435e90507b6Ac81A` |
| ERC-8004 Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### Mainnet (Base, chainId 8453)

| Contract | Address |
|----------|---------|
| ACTPKernel | `0x132B9eB321dBB57c828B083844287171BDC92d29` |
| EscrowVault | `0x6aAF45882c4b0dD34130ecC790bb5Ec6be7fFb99` |
| USDC (Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| X402Relay | `0x81DFb954A3D58FEc24Fc9c946aC2C71a911609F8` |
| ERC-8004 Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ACTP_KEY_PASSWORD` | Yes (if using keystore) | Password to decrypt `.actp/keystore.json` |
| `ACTP_PRIVATE_KEY` | Alternative to keystore | Raw private key (0x-prefixed, 64 hex chars) |
| `BASE_SEPOLIA_RPC` | No | Custom RPC for testnet (default provided) |
| `BASE_RPC_URL` | No | Custom RPC for mainnet (default provided) |

SDK auto-detect order: `ACTP_PRIVATE_KEY` env var -> `.actp/keystore.json` + `ACTP_KEY_PASSWORD`.

---

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
    client = await ACTPClient.create(mode="testnet")
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
result = await client.basic.pay({"amount": "100.00"})  # String

# Prefer strings for precision
result = await client.basic.pay({"amount": "100.005"})
```

### 4. Using Old Key Management

```python
# WRONG - deprecated pattern
client = await ACTPClient.create(
    mode="testnet",
    private_key=os.environ["PRIVATE_KEY"],          # old env var name
    requester_address=os.environ["REQUESTER_ADDRESS"],  # removed
)

# CORRECT - keystore auto-detect (address derived from key)
client = await ACTPClient.create(mode="testnet")

# CORRECT - explicit BYOW with new env var
client = await ACTPClient.create(
    mode="testnet",
    private_key=os.environ["ACTP_PRIVATE_KEY"],
)
```

### 5. Missing IN_PROGRESS Before DELIVERED

```python
# WRONG - contract rejects this
await client.standard.transition_state(tx_id, "DELIVERED", proof)

# CORRECT - must go through IN_PROGRESS first
await client.standard.transition_state(tx_id, "IN_PROGRESS")
await client.standard.transition_state(tx_id, "DELIVERED", proof)
```

### 6. Forgetting to Register x402 Adapter

```python
# WRONG - x402 is not registered by default
await client.basic.pay({"to": "https://api.provider.com/service", "amount": "5"})
# Error: No adapter found for URL target

# CORRECT - register adapter first
client.register_adapter(X402Adapter(await client.get_address(), {
    "expected_network": "base-sepolia",  # or "base-mainnet"
    "transfer_fn": transfer_usdc,  # async fn(to, amount) -> tx_hash
}))
await client.basic.pay({"to": "https://api.provider.com/service", "amount": "5"})
```

---

## Mock vs Testnet vs Mainnet

| Behavior | Mock | Testnet/Mainnet |
|----------|------|-----------------|
| Wallet setup | Random address generated | Generate new or bring your own key |
| USDC | `actp init` mints 10,000 test USDC | Real USDC (testnet faucet or bridge) |
| Escrow release | `request()` auto-releases after dispute window | **Manual `release()` required** |
| Gas fees | None (simulated) | EOA: real ETH. Auto wallet (`wallet="auto"`): gasless via paymaster |
| Transaction limit | None | $1,000 per tx (mainnet) |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Insufficient balance" | Mock: `actp mint <address> 10000`. Testnet: faucet. Mainnet: bridge USDC via bridge.base.org. |
| "Invalid state transition" | Check state machine table. States only move forward. |
| `COMMITTED -> DELIVERED` reverts | Missing IN_PROGRESS. Add `transition_state(tx_id, "IN_PROGRESS")` first. |
| Invalid proof error | Wrong encoding. Use ethers ABI encoding with correct types. |
| RPC 503 errors | Base Sepolia public RPC has rate limits. Set `BASE_SEPOLIA_RPC` to Alchemy URL. |
| Mainnet $1000 limit | Security limit on unaudited contracts. |
| "No adapter found" | x402 and ERC-8004 adapters must be registered explicitly. |

---

## Cross-References

- **OpenClaw Skill**: Full agent templates, onboarding wizard, OpenClaw integration
- **TypeScript SDK**: See `agirails-typescript` skill for TypeScript-specific patterns
- **n8n Node**: `n8n-nodes-actp` for no-code workflow integration
- **SDK Examples**: https://github.com/agirails/sdk-examples

---

## Resources

- **Documentation**: https://docs.agirails.io
- **SDK (pip)**: https://pypi.org/project/agirails/
- **SDK (npm)**: https://www.npmjs.com/package/@agirails/sdk
- **GitHub**: https://github.com/agirails
- **Discord**: https://discord.gg/nuhCt75qe4
- **Support**: support@agirails.io
- **Security**: security@agirails.io
