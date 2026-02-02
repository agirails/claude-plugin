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
│  Current version:  2.0.5                                        │
│  Latest version:   2.1.0                                        │
│  Update available: Yes                                          │
│                                                                 │
│  Changes in 2.1.0:                                              │
│  ✓ Added batch transaction support                              │
│  ✓ Improved error messages                                      │
│  ✓ Gas optimization (15% reduction)                             │
│  ⚠ BREAKING: Renamed client.events.on() to client.events.watch()│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Proceed with upgrade?
Options: [Upgrade to 2.1.0] [View full changelog] [Skip]
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

Found 3 files that need migration:

1. src/services/payment.ts:45
   - client.events.on('stateChange', ...)
   → client.events.watch('stateChange', ...)

2. src/services/payment.ts:78
   - client.events.on('escrowLinked', ...)
   → client.events.watch('escrowLinked', ...)

3. src/lib/monitor.ts:23
   - client.events.on('paymentReleased', ...)
   → client.events.watch('paymentReleased', ...)

Apply migrations?
Options: [Apply all] [Review each] [Skip - I'll do it manually]
```

### Step 5: Migration Patterns by Version

#### 1.x → 2.0 Migration

**Client Initialization:**
```typescript
// OLD (1.x)
const client = new ACTPClient({
  network: 'base-sepolia',
  privateKey: '0x...',
});

// NEW (2.0)
const client = await ACTPClient.create({
  mode: 'testnet',  // 'mock' | 'testnet' | 'mainnet'
  privateKey: '0x...',
});
```

**Transaction Creation:**
```typescript
// OLD (1.x)
const txId = await client.createTransaction({
  provider: '0x...',
  amount: 100,
  deadline: Date.now() + 86400000,
});

// NEW (2.0)
const result = await client.basic.pay({
  to: '0x...',
  amount: 100.00,
  deadline: '+24h',  // Human-readable format
});
const txId = result.txId;
```

**State Transitions:**
```typescript
// OLD (1.x)
await client.transitionState(txId, 'DELIVERED');

// NEW (2.0) - IN_PROGRESS required before DELIVERED
await client.standard.transitionState(txId, 'IN_PROGRESS');
// DELIVERED requires ABI-encoded dispute window proof
const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const proof = abiCoder.encode(['uint256'], [172800]); // 2 days
await client.standard.transitionState(txId, 'DELIVERED', proof);
```

**Error Handling:**
```typescript
// OLD (1.x)
try {
  await client.pay(...);
} catch (e) {
  if (e.code === 'INSUFFICIENT_BALANCE') { ... }
}

// NEW (2.0)
import { InsufficientBalanceError } from '@agirails/sdk';

try {
  await client.basic.pay(...);
} catch (e) {
  if (e instanceof InsufficientBalanceError) {
    console.log('Need:', e.required);
    console.log('Have:', e.available);
  }
}
```

#### 2.0 → 2.1 Migration

**Event Listening:**
```typescript
// OLD (2.0)
client.events.on(EventType.STATE_CHANGED, (event) => { ... });

// NEW (2.1)
client.events.watch(EventType.STATE_CHANGED, (event) => { ... });
```

**Batch Operations:**
```typescript
// NEW in 2.1: Batch transactions
const results = await client.advanced.batchPay([
  { to: '0x...', amount: 10.00 },
  { to: '0x...', amount: 20.00 },
  { to: '0x...', amount: 30.00 },
]);
```

### Step 6: Verification

After upgrade, verify installation:

```typescript
import { ACTPClient, VERSION } from '@agirails/sdk';

console.log('SDK Version:', VERSION);  // Should show 2.1.0

// Test connection
const client = await ACTPClient.create({ mode: 'mock' });
console.log('Mock mode:', client.mode === 'mock');
console.log('Connection OK:', client.isConnected);
```

### Step 7: Post-Upgrade Checklist

```
┌─────────────────────────────────────────────────────────────────┐
│  POST-UPGRADE CHECKLIST                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [x] SDK upgraded to 2.1.0                                      │
│  [x] Breaking changes migrated (3 files)                        │
│  [ ] Run tests: npm test                                        │
│  [ ] Test mock mode: npx ts-node test-mock.ts                   │
│  [ ] Test testnet (if applicable)                               │
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
npm install @agirails/sdk@2.0.5  # Specific version
```

**Python:**
```bash
pip install agirails==2.0.5  # Specific version
```

## Version History

| Version | Release | Highlights |
|---------|---------|------------|
| 2.1.0 | 2025-12 | Batch transactions, improved events |
| 2.0.0 | 2025-11 | Three-tier API, mock mode |
| 1.0.0 | 2025-10 | Initial release |

## Best Practices

1. **Always test in mock mode first** after upgrading
2. **Pin versions in production**: Use exact versions, not `^` or `~`
3. **Review changelog** before upgrading: https://docs.agirails.io/changelog
4. **Backup configuration** before major version upgrades
5. **Run full test suite** after any upgrade
