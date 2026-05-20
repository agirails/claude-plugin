---
description: Upgrade AGIRAILS SDK to latest version with migration guidance for breaking changes.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Edit
  - AskUserQuestion
argument-hint: "[version]"
---

# /agirails:upgrade

Upgrade AGIRAILS SDK with automatic migration assistance.

## What This Command Does

1. Check current SDK version
2. Fetch latest version info
3. Show changelog and breaking changes
4. Run upgrade command
5. Assist with any required migrations

## Step-by-Step Instructions

### Step 1: Detect Current Installation

**TypeScript:**
```bash
# Check installed version
cat node_modules/@agirails/sdk/package.json | grep version
```

**Python:**
```bash
# Check installed version
pip show agirails | grep Version
```

### Step 2: Check for Updates

Display current vs latest:
```
┌─────────────────────────────────────────────────────────────────┐
│  AGIRAILS SDK VERSION CHECK                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Current version:  3.5.3                                        │
│  Latest version:   4.0.0                                        │
│  Update available: Yes                                          │
│                                                                 │
│  Changes in 4.0.0:                                              │
│  ✓ Base mainnet redeploy 2026-05-19 (new addresses)             │
│  ✓ INV-30 per-tx disputeBondBpsLocked (hardening)               │
│  ✓ AIP-14 dispute bonds + initiator tracking                    │
│  ✓ Canonical 21-field TransactionView ABI                       │
│  ✓ Workflow-attested publish (OIDC + SLSA provenance)           │
│  ⚠ BREAKING: mainnet address surface changed                    │
│  ⚠ BREAKING: x402Relay removed from base-mainnet config         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Proceed with upgrade?
Options: [Upgrade to 4.0.0] [View full changelog] [Skip]
```

### Step 3: Upgrade Command

**TypeScript (npm):**
```bash
npm install @agirails/sdk@latest
```

**TypeScript (yarn):**
```bash
yarn add @agirails/sdk@latest
```

**TypeScript (pnpm):**
```bash
pnpm add @agirails/sdk@latest
```

**Python (pip):**
```bash
pip install --upgrade agirails
```

**Python (poetry):**
```bash
poetry update agirails
```

### Step 4: Migration Assistance

If breaking changes exist, search codebase and offer to fix:

```
Scanning for affected code patterns...

Found 2 files that need migration:

1. src/services/payment.ts:45
   - client.standard.transitionState(txId, 'DELIVERED')
   → client.standard.transitionState(txId, 'IN_PROGRESS')
     client.standard.transitionState(txId, 'DELIVERED', proof)

2. src/services/payment.ts:78
   - client.standard.linkEscrow(txId, { amount })
   → client.standard.linkEscrow(txId)

Apply migrations?
Options: [Apply all] [Review each] [Skip - I'll do it manually]
```

### Step 5: Migration Patterns by Version

#### 3.x → 4.0.0 Migration

**Mainnet address surface change.** The Base mainnet kernel was redeployed 2026-05-19; all four core contracts moved. If you've hardcoded addresses, swap; if you read via `getNetwork('base-mainnet').contracts.*`, the swap is automatic on this bump.

**X402Relay removed from mainnet config:**
```typescript
// OLD (3.x): x402Relay could be accessed on mainnet
const relay = getNetwork('base-mainnet').contracts.x402Relay;

// NEW (4.0.0): x402Relay is undefined on mainnet (deprecated since 3.3.0)
// Payments route directly buyer→seller via @x402/fetch + facilitator
// On Sepolia x402Relay still exists for legacy direct-call consumers.
const relay = getNetwork('base-sepolia').contracts.x402Relay; // still works
```

**X402Adapter is auto-registered (since SDK 3.3.0, unchanged in 4.0.0):**
```typescript
// OLD (pre-3.3.0): manual registration
client.registerAdapter(new X402Adapter(client.getAddress(), {
  expectedNetwork: 'base-sepolia',
  transferFn: ...,
  feeCollector: ...,
}));

// NEW (3.3.0+): just opt in via metadata
const result = await client.basic.pay({
  to: 'https://api.example.com/...',
  amount: 0.05,
  metadata: { paymentMethod: 'x402' },
});
```

**TransactionView ABI: 2 new uint16 fields.** The canonical `getTransaction()` tuple grew from 19 to 21 fields (added `requesterPenaltyBpsLocked` + `disputeBondBpsLocked`). SDK 4.0.0 ships the matching ABI — consumers that read via `client.standard.getTransaction(txId)` see the typed result automatically; raw ethers callers should pull the ABI from `@agirails/sdk/dist/abi/ACTPKernel.json` instead of pinning an older copy.

**Sepolia kernel also moved.** Sepolia redeployed alongside mainnet (V4) so both networks return the same canonical 21-field tuple shape. Old Sepolia kernel `0xE83cba71…` is retired — anyone reading stuck txs from there should pin to `@agirails/sdk@4.0.0-beta.11`.

#### 2.x → 3.x Migration (collapsed — see git log on @agirails/sdk for full notes)

- Adapter routing (ACTP / x402 / ERC-8004) — auto-routed by destination shape
- AIP-12 Smart Wallet + paymaster gasless flows
- Apex audit hardening (10+ FIND closures)
- Last 3.x stable: `3.5.3`

### Step 6: Verification

After upgrade, verify installation:

```typescript
import { ACTPClient } from '@agirails/sdk';

// Test connection (keystore auto-detect)
const client = await ACTPClient.create({
  mode: 'mock',
});
console.log('Mode:', client.getMode());
console.log('Mock mode:', client.getMode() === 'mock');
```

### Step 7: Post-Upgrade Checklist

```
┌─────────────────────────────────────────────────────────────────┐
│  POST-UPGRADE CHECKLIST                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [x] SDK upgraded to 4.0.0                                      │
│  [x] Breaking changes migrated                                  │
│  [ ] Run tests: npm test                                        │
│  [ ] Test mock mode: npx ts-node test-mock.ts                   │
│  [ ] Test testnet (if applicable)                               │
│  [ ] Verify mainnet integration uses getNetwork() helper        │
│                                                                 │
│  Need help?                                                     │
│  - /agirails:debug for troubleshooting                          │
│  - /agirails:example for updated code patterns                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Rollback

If upgrade causes issues:

**TypeScript:**
```bash
npm install @agirails/sdk@3.5.3  # Last stable 3.x — uses retired V2 mainnet contracts
```

**Python:**
```bash
pip install agirails==2.4.0  # Last stable Python SDK on PyPI
```

> **Note on rollback:** Pinning to 3.5.3 means using the retired V2 mainnet kernel (`0x132B9eB3…`). That contract is still live but receives no new SDK traffic; only use as a temporary measure while you debug a 4.0.0 incompatibility. File an issue at https://github.com/agirails/sdk-js/issues so we can land a 4.0.1 patch instead.

## Version History

| Version | Release | Highlights |
|---------|---------|------------|
| **4.0.0** | **2026-05-19** | Mainnet V3 + Sepolia V4 redeploy, INV-30, canonical 21-field ABI, workflow-attested publish |
| 3.5.3 | 2026-04-18 | Mainnet-compat legacy 16-field ABI fallback, RPC default to publicnode |
| 3.3.0 | 2026-04-12 | x402 v2, X402Adapter auto-registration |
| 3.0.0 | 2026-02 | Adapter routing, x402, ERC-8004, AIP-13 keystore, Smart Wallet |
| 2.5.0 | 2026-01 | Deployment security, AGIRAILS.md SOT, pending publish |
| 2.0.0 | 2025-12 | Three-tier API, mock mode |
| 1.0.0 | 2025-10 | Initial release |

## Best Practices

1. **Always test in mock mode first** after upgrading
2. **Pin versions in production**: Use exact versions, not `^` or `~`
3. **Review changelog** before upgrading: https://docs.agirails.io/changelog
4. **Backup configuration** before major version upgrades
5. **Run full test suite** after any upgrade
