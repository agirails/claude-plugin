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
- Adapter routing: ACTP escrow, x402 instant payments, ERC-8004 identity resolution
- Config management: AGIRAILS.md as source of truth (on-chain hash + IPFS CID)

## Deployed Contracts

### Testnet (Base Sepolia, chainId 84532)

| Contract | Address |
|----------|---------|
| ACTPKernel | `0x469CBADbACFFE096270594F0a31f0EEC53753411` |
| EscrowVault | `0x57f888261b629bB380dfb983f5DA6c70Ff2D49E5` |
| MockUSDC | `0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb` |
| AgentRegistry | `0xDd6D66924B43419F484aE981F174b803487AF25A` |
| X402Relay | `0x4DCD02b276Dbeab57c265B72435e90507b6Ac81A` |
| Identity (ERC-8004) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation (ERC-8004) | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| ArchiveTreasury | `0xeB75DE7cF5ce77ab15BB0fFa3a2A79e6aaa554B0` |

### Mainnet (Base, chainId 8453)

| Contract | Address |
|----------|---------|
| ACTPKernel | `0x132B9eB321dBB57c828B083844287171BDC92d29` |
| EscrowVault | `0x6aAF45882c4b0dD34130ecC790bb5Ec6be7fFb99` |
| USDC (Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AgentRegistry | `0x6fB222CF3DDdf37Bcb248EE7BBBA42Fb41901de8` |
| X402Relay | `0x81DFb954A3D58FEc24Fc9c946aC2C71a911609F8` |
| Identity (ERC-8004) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation (ERC-8004) | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| ArchiveTreasury | `0x0516C411C0E8d75D17A768022819a0a4FB3cA2f2` |

Mainnet transaction limit: $1,000 per tx.

## Now vs Roadmap

**Available now:**
- `provide()` / `request()` — register as provider or requester
- Escrow-based payments via ACTPKernel + EscrowVault
- 8-state machine with deterministic transitions
- Three runtime modes: mock, testnet (Base Sepolia), mainnet (Base)
- CLI with 24 commands: init, balance, pay, tx, watch, publish, pull, diff, simulate, batch, mint, config, time
- ERC-8004 portable identity and reputation
- Config management via AGIRAILS.md (on-chain hash + IPFS CID)
- Adapter routing: ACTP escrow, x402 instant payments, ERC-8004 resolution
- x402 instant payments via X402Relay contract

**Recently implemented (not yet fully mainnet):**
- AIP-12 Payment Abstraction: Smart Wallet (ERC-4337) + Paymaster
- `wallet: 'auto'` in `ACTPClient.create()` generates local encrypted keystore + Smart Wallet + micro-airdrop gas
- Three-tier wallet architecture: Tier 1 Auto (90%), Tier 2 BYOW, Tier 3 CDP TEE (enterprise)
- Ethers-only implementation (no viem yet)

**Soon:**
- Job Board MVP — marketplace matching
- Global capability registry with discovery
- Auto-bidding and negotiation protocols

## 8-State Machine

Transactions progress through 8 states. States only move forward — never backwards.

```
INITIATED -> QUOTED -> COMMITTED -> IN_PROGRESS -> DELIVERED -> SETTLED
     |          |          |                            |
     +----------+----------+-- CANCELLED                +-- DISPUTED -> SETTLED
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
- Happy path: `INITIATED -> COMMITTED -> IN_PROGRESS -> DELIVERED -> SETTLED`
- With quote: `INITIATED -> QUOTED -> COMMITTED -> IN_PROGRESS -> DELIVERED -> SETTLED`
- Dispute: `INITIATED -> COMMITTED -> IN_PROGRESS -> DELIVERED -> DISPUTED -> SETTLED`
- Cancel: `INITIATED -> CANCELLED` or `COMMITTED -> CANCELLED`

For complete state transition rules, see `references/state-machine.md`.

## Escrow

Escrow is the heart of ACTP. Funds are locked in the EscrowVault contract and only released according to state machine rules.

**Escrow lifecycle:**

```
1. Lock (COMMITTED)       -- Requester's USDC transferred to EscrowVault
       |
2. Hold (IN_PROGRESS/DELIVERED) -- Funds held while provider works
       |
3. Release (SETTLED)      -- Provider receives amount minus 1% fee
       |
   OR
       |
4. Refund (CANCELLED)     -- Requester gets full refund
```

- **Lock**: When a transaction reaches COMMITTED, the requester's USDC is transferred to EscrowVault via `safeTransferFrom`. The ACTP batch call handles `createTransaction + approve + linkEscrow` in one operation.
- **Hold**: During IN_PROGRESS and DELIVERED states, funds remain locked. Neither party can withdraw.
- **Release**: On SETTLED, the provider receives the escrowed amount minus the platform fee. Fee goes to ArchiveTreasury.
- **Refund**: On CANCELLED (from INITIATED, COMMITTED, or IN_PROGRESS), the full escrowed amount returns to the requester.

**Important runtime differences:**
- Mock mode: Auto-releases after dispute window expires
- Testnet / Mainnet: You MUST call `release()` explicitly to settle

## Fee Structure

ACTP uses a simple fee model:

```
Fee = max(amount * 1%, $0.05)
```

| Transaction | Calculation | Fee |
|-------------|-------------|-----|
| $1.00 | max($0.01, $0.05) | $0.05 |
| $5.00 | max($0.05, $0.05) | $0.05 |
| $10.00 | max($0.10, $0.05) | $0.10 |
| $100.00 | max($1.00, $0.05) | $1.00 |

The fee is deducted from the escrowed amount when funds are released to the provider. On-chain constants: `platformFeeBps = 100` (1%), `MIN_FEE = 50000` ($0.05 in USDC 6-decimal), `MAX_FEE_CAP = 500` (5% hard cap).

## x402 Instant Payments

x402 is an HTTP-native payment protocol for instant, one-request-one-response payments. Unlike ACTP escrow (designed for complex multi-step jobs), x402 is for simple pay-per-call scenarios.

**ACTP vs x402:**

| Property | ACTP (Escrow) | x402 (Instant) |
|----------|---------------|-----------------|
| Use case | Complex jobs, multi-step work | Pay-per-call, API access |
| Payment flow | Lock -> Hold -> Release | Single atomic transfer |
| Dispute resolution | Yes (bilateral + mediator) | No |
| State machine | 8 states | None (instant settlement) |
| Fee | 1% / $0.05 min | 1% / $0.05 min (same) |
| Contract | ACTPKernel + EscrowVault | X402Relay |
| Refunds | Yes (CANCELLED state) | No |
| Delivery proof | On-chain (EAS attestation) | HTTP response body |

**X402Relay contract** handles fee splitting atomically:
- Splits payment into provider share + platform fee in a single transaction
- Same fee formula: `max(grossAmount * bps / 10000, MIN_FEE)`
- Fees go to ArchiveTreasury (same as ACTP)

**Using x402 in SDK:**
```
import { X402Adapter } from '@agirails/sdk';

// Register the adapter
client.registerAdapter(new X402Adapter(client.advanced, client.getAddress()));

// Pay via URL (adapter auto-routes to x402)
await client.pay('https://provider.example.com/api/endpoint', { amount: 0.50 });
```

## Adapter Routing

The SDK routes payments automatically based on the `to` parameter format:

| `to` value | Adapter | Registration |
|------------|---------|--------------|
| `0x1234...` (address) | ACTP (basic/standard) | Default, always available |
| `https://...` (URL) | x402 | Must register `X402Adapter` |
| agent ID (number) | ERC-8004 | Must configure ERC-8004 bridge |

- Address routing (`0x...`) uses the default ACTP adapter with escrow.
- URL routing (`https://...`) uses x402 for instant HTTP payments. Requires `X402Adapter` registration.
- Agent ID routing resolves the numeric ID through the ERC-8004 Identity registry to get the agent's on-chain address, then routes via ACTP.

## Identity (ERC-8004)

ERC-8004 provides portable, cross-marketplace agent identity and reputation. It replaces any legacy DID approach.

- **Optional** — you can use ACTP with raw addresses, but ERC-8004 gives you portable identity
- **Portable** — any ERC-8004-compatible marketplace recognizes your agent
- **On-chain** — identity and reputation live on Base L2

**Registries:**

| Registry | Sepolia | Mainnet |
|----------|---------|---------|
| Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

These are canonical CREATE2 addresses (same on all chains).

Register via `@agirails/sdk/erc8004`:
```
import { ERC8004Client } from '@agirails/sdk/erc8004';

const identity = new ERC8004Client(provider, signer);
await identity.register({ name: 'my-agent', capabilities: ['code-review'] });
```

## Config Management

AGIRAILS.md is the source of truth for an agent's configuration. The config pipeline hashes the file and stores both a `configHash` and `configCID` (IPFS) in the AgentRegistry contract.

```bash
actp publish   # Hash AGIRAILS.md -> store configHash + configCID in AgentRegistry
actp diff      # Compare local AGIRAILS.md vs on-chain configHash
actp pull      # Restore AGIRAILS.md from on-chain configCID (IPFS)
```

- `publishConfig()` writes `configHash` (keccak256 of file contents) and `configCID` (IPFS CID) to AgentRegistry
- `actp diff` computes local hash, fetches on-chain hash, reports match/mismatch
- `actp pull` fetches the IPFS CID from AgentRegistry, downloads from IPFS gateway, restores locally
- **Drift detection**: `ACTPClient.create()` checks local vs on-chain config and logs a non-blocking warning if they diverge

## Capabilities

Capabilities describe what an agent can do. They are declared in AGIRAILS.md and matched by exact string.

**Categories and examples:**

| Category | Capabilities |
|----------|-------------|
| code | code-review, bug-fixing, feature-dev, refactoring, testing |
| security | security-audit, smart-contract-audit, pen-testing |
| data | data-analysis, research, data-extraction, web-scraping |
| content | content-writing, copywriting, translation, summarization |
| ops | automation, integration, devops, monitoring |

- Matching is **exact string only** — `code-review` matches `code-review`, not `Code Review`
- No discovery mechanism yet (Job Board will add this)
- `ServiceDirectory` is in-memory, per-process — not persistent across restarts

## Mock vs Testnet vs Mainnet

| Behavior | Mock | Testnet (Sepolia) | Mainnet (Base) |
|----------|------|-------------------|----------------|
| Wallet | Random in-memory address | Generate keystore or BYOK | Generate keystore or BYOK |
| USDC | `actp init` mints 10,000 MockUSDC | MockUSDC (faucet) | Real USDC (Circle) |
| Escrow release | Auto after dispute window | Manual `release()` required | Manual `release()` required |
| Gas | None (simulated) | Sepolia ETH for gas (or gasless with `wallet:'auto'`) | Base ETH for gas (or gasless with `wallet:'auto'`) |
| Transaction limit | None | None | $1,000 per tx |
| Chain | In-memory | Base Sepolia (84532) | Base Mainnet (8453) |
| Use case | Local development, CI | Integration testing | Production |

## Core Invariants

The protocol guarantees 10 invariants that must hold at all times:

1. **Escrow Solvency** - Vault balance >= sum of all active transaction amounts
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
        |
        v
   +-----------+
   | COMMITTED | --- deadline --------> Can be cancelled
   +-----+-----+
         |
         v (provider delivers)
   +-----------+
   | DELIVERED | --- dispute window --> Auto-settles
   +-----+-----+
         |
         v (release or dispute)
   +-----------+
   |  SETTLED  |
   +-----------+
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

## CLI Reference

All commands support `--json` for machine-readable output and `-q`/`--quiet` for silent operation.

### Project Setup

| Command | Description |
|---------|-------------|
| `actp init` | Initialize project, generate keystore, mint MockUSDC (mock mode) |
| `actp init --scaffold` | Initialize with full project scaffold (AGIRAILS.md, directories) |

### Payments

| Command | Description |
|---------|-------------|
| `actp pay` | Send a payment (routes via adapter: ACTP, x402, or ERC-8004) |
| `actp balance` | Show USDC and ETH balance for current wallet |

### Transaction Lifecycle

| Command | Description |
|---------|-------------|
| `actp tx create` | Create a new ACTP transaction |
| `actp tx status` | Check status of a transaction by ID |
| `actp tx list` | List transactions (filterable by state, role) |
| `actp tx deliver` | Mark transaction as DELIVERED (provider) |
| `actp tx settle` | Release escrowed funds (requester) |
| `actp tx cancel` | Cancel a transaction (requester, before DELIVERED) |

### Monitoring

| Command | Description |
|---------|-------------|
| `actp watch` | Watch for incoming transactions in real-time |

### Simulation

| Command | Description |
|---------|-------------|
| `actp simulate pay` | Simulate a payment without sending on-chain |
| `actp simulate fee` | Calculate fee for a given amount |

### Batch Operations

| Command | Description |
|---------|-------------|
| `actp batch` | Execute multiple transactions from a JSON file |

### Token Operations

| Command | Description |
|---------|-------------|
| `actp mint` | Mint MockUSDC (mock/testnet only) |

### Configuration

| Command | Description |
|---------|-------------|
| `actp config show` | Display current configuration |
| `actp config set` | Set a configuration value |
| `actp config get` | Get a specific configuration value |

### Config Management (AGIRAILS.md)

| Command | Description |
|---------|-------------|
| `actp publish` | Hash AGIRAILS.md, store configHash + configCID on-chain |
| `actp pull` | Restore AGIRAILS.md from on-chain configCID (IPFS) |
| `actp diff` | Compare local AGIRAILS.md vs on-chain configHash |

### Time Management (Mock Mode)

| Command | Description |
|---------|-------------|
| `actp time show` | Show current mock blockchain time |
| `actp time advance` | Advance mock time by N seconds |
| `actp time set` | Set mock time to specific timestamp |

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

**Transaction ID computation:**
```
transactionId = keccak256(requester, provider, amount, serviceHash, nonce)
```
The `requesterNonces` mapping is public, enabling txId pre-computation before submission.

**ACTP batch call** combines three operations atomically:
```
createTransaction + approve + linkEscrow
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
| ConfigDriftDetected | Local != on-chain config | Run `actp publish` or `actp pull` |
| AdapterNotRegistered | Missing adapter for route | Register required adapter |
| TransactionLimitExceeded | Over $1,000 on mainnet | Split into smaller transactions |

## Related Resources

- State machine details: `references/state-machine.md`
- Invariant specifications: `references/invariants.md`
- SDK patterns: See `agirails-typescript` or `agirails-python` skills
- Security checklist: See `agirails-security` skill
- AGIRAILS.md specification: See `agirails-config` skill
- x402 protocol: See `agirails-x402` skill
- ERC-8004 identity: See `agirails-identity` skill
