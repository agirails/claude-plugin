---
description: Generate runnable code examples for common ACTP use cases. Automatically adapts to project language and SDK version.
allowed-tools:
  - Read
  - Glob
  - Write
  - AskUserQuestion
argument-hint: "[use_case]"
---

# /agirails:example

Generate ready-to-run code examples for AGIRAILS SDK integration.

## What This Command Does

1. Detect project language (TypeScript or Python)
2. Show available use cases
3. Generate complete, runnable code example
4. Optionally save to file

## Step-by-Step Instructions

### Step 1: Detect Language

Check project files:
```
Glob("package.json")     → TypeScript
Glob("pyproject.toml")   → Python
Glob("requirements.txt") → Python
```

If ambiguous, ask user.

### Step 2: Select Use Case

If argument provided, match against known use cases.

Otherwise, present options:
```
"What would you like to build?"
Options:
  [Basic Payment] - Simple pay and release flow
  [Full Lifecycle] - Complete transaction with all states
  [Dispute Handling] - Handle disputes and resolutions
  [Event Monitoring] - Listen for transaction events
  [Batch Operations] - Multiple transactions efficiently
  [Agent Integration] - Integrate with AI agent framework
```

### Step 3: Generate Example

#### Basic Payment (TypeScript)

```typescript
/**
 * AGIRAILS Basic Payment Example
 *
 * This example demonstrates the simplest payment flow:
 * 1. Create client
 * 2. Make payment
 * 3. Provider delivers
 * 4. Release funds
 *
 * Run: npx ts-node basic-payment.ts
 */

import { ACTPClient } from '@agirails/sdk';

// Configuration
const REQUESTER_ADDRESS = '0x1111111111111111111111111111111111111111';
const PROVIDER_ADDRESS = '0x2222222222222222222222222222222222222222';
const PAYMENT_AMOUNT = 10.00; // USDC

async function main() {
  console.log('=== AGIRAILS Basic Payment ===\n');

  // 1. Create client in mock mode (no real funds needed)
  const client = await ACTPClient.create({
    mode: 'mock',
    requesterAddress: REQUESTER_ADDRESS,
  });
  console.log('✓ Client created in mock mode\n');

  // 2. Mint test USDC (mock mode only)
  await client.mock.mint(REQUESTER_ADDRESS, 1000);
  const balance = await client.basic.getBalance();
  console.log(`✓ Balance: ${balance} USDC\n`);

  // 3. Create payment
  const result = await client.basic.pay({
    to: PROVIDER_ADDRESS,
    amount: PAYMENT_AMOUNT,
    deadline: '+24h',
    serviceDescription: 'AI code review service',
  });
  console.log('✓ Payment created');
  console.log(`  Transaction ID: ${result.txId}`);
  console.log(`  State: ${result.state}`);
  console.log(`  Fee: ${result.fee} USDC\n`);

  // 4. Simulate provider delivering (in production, provider calls this)
  await client.standard.transitionState(result.txId, 'DELIVERED', {
    resultHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    resultUrl: 'ipfs://QmExampleHash',
  });
  console.log('✓ Provider delivered\n');

  // 5. Release payment
  await client.basic.release(result.txId);
  console.log('✓ Payment released to provider\n');

  // 6. Verify final state
  const status = await client.basic.checkStatus(result.txId);
  console.log(`Final state: ${status.state}`);
  console.log(`Transaction complete: ${status.isTerminal}\n`);

  console.log('=== Example Complete ===');
}

main().catch(console.error);
```

#### Basic Payment (Python)

```python
"""
AGIRAILS Basic Payment Example

This example demonstrates the simplest payment flow:
1. Create client
2. Make payment
3. Provider delivers
4. Release funds

Run: python basic_payment.py
"""

import asyncio
from agirails import ACTPClient

# Configuration
REQUESTER_ADDRESS = "0x1111111111111111111111111111111111111111"
PROVIDER_ADDRESS = "0x2222222222222222222222222222222222222222"
PAYMENT_AMOUNT = 10.00  # USDC


async def main():
    print("=== AGIRAILS Basic Payment ===\n")

    # 1. Create client in mock mode (no real funds needed)
    client = await ACTPClient.create(
        mode="mock",
        requester_address=REQUESTER_ADDRESS,
    )
    print("✓ Client created in mock mode\n")

    # 2. Mint test USDC (mock mode only)
    await client.mock.mint(REQUESTER_ADDRESS, 1000)
    balance = await client.basic.get_balance()
    print(f"✓ Balance: {balance} USDC\n")

    # 3. Create payment
    result = await client.basic.pay({
        "to": PROVIDER_ADDRESS,
        "amount": PAYMENT_AMOUNT,
        "deadline": "24h",
        "service_description": "AI code review service",
    })
    print("✓ Payment created")
    print(f"  Transaction ID: {result.tx_id}")
    print(f"  State: {result.state}")
    print(f"  Fee: {result.fee} USDC\n")

    # 4. Simulate provider delivering
    await client.standard.transition_state(
        result.tx_id,
        "DELIVERED",
        metadata={
            "result_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            "result_url": "ipfs://QmExampleHash",
        }
    )
    print("✓ Provider delivered\n")

    # 5. Release payment
    await client.basic.release(result.tx_id)
    print("✓ Payment released to provider\n")

    # 6. Verify final state
    status = await client.basic.check_status(result.tx_id)
    print(f"Final state: {status.state}")
    print(f"Transaction complete: {status.is_terminal}\n")

    print("=== Example Complete ===")


if __name__ == "__main__":
    asyncio.run(main())
```

#### Full Lifecycle (TypeScript)

```typescript
/**
 * AGIRAILS Full Transaction Lifecycle
 *
 * Demonstrates all 8 states of the ACTP protocol:
 * INITIATED → QUOTED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED
 *
 * Run: npx ts-node full-lifecycle.ts
 */

import { ACTPClient } from '@agirails/sdk';

const REQUESTER = '0x1111111111111111111111111111111111111111';
const PROVIDER = '0x2222222222222222222222222222222222222222';

async function main() {
  console.log('=== AGIRAILS Full Transaction Lifecycle ===\n');

  // Create clients for both parties
  const requesterClient = await ACTPClient.create({
    mode: 'mock',
    requesterAddress: REQUESTER,
  });

  const providerClient = await ACTPClient.create({
    mode: 'mock',
    requesterAddress: PROVIDER, // Provider perspective
  });

  // Mint tokens
  await requesterClient.mock.mint(REQUESTER, 1000);

  // STATE 1: INITIATED
  console.log('1. Creating transaction (INITIATED)...');
  const tx = await requesterClient.standard.createTransaction({
    provider: PROVIDER,
    amount: 50.00,
    deadline: '+48h',
    disputeWindow: '24h',
    serviceDescription: 'Custom AI model training',
  });
  console.log(`   State: INITIATED`);
  console.log(`   Transaction ID: ${tx.txId}\n`);

  // STATE 2: QUOTED (optional - provider can quote different price)
  console.log('2. Provider submitting quote (QUOTED)...');
  await providerClient.standard.transitionState(tx.txId, 'QUOTED', {
    quotedAmount: 45.00, // Provider offers discount
    estimatedDelivery: '2 days',
  });
  console.log(`   State: QUOTED`);
  console.log(`   Quoted amount: $45.00\n`);

  // STATE 3: COMMITTED (requester accepts, escrow linked)
  console.log('3. Requester accepting quote (COMMITTED)...');
  await requesterClient.standard.linkEscrow(tx.txId, {
    amount: 45.00, // Accepted quoted amount
  });
  console.log(`   State: COMMITTED`);
  console.log(`   Escrow linked, funds locked\n`);

  // STATE 4: IN_PROGRESS (provider signals work started)
  console.log('4. Provider starting work (IN_PROGRESS)...');
  await providerClient.standard.transitionState(tx.txId, 'IN_PROGRESS', {
    progressNote: 'Training started, 0% complete',
  });
  console.log(`   State: IN_PROGRESS\n`);

  // Simulate progress updates
  for (const progress of [25, 50, 75, 100]) {
    await new Promise(r => setTimeout(r, 500));
    console.log(`   Progress: ${progress}%`);
  }
  console.log();

  // STATE 5: DELIVERED (provider completes work)
  console.log('5. Provider delivering result (DELIVERED)...');
  await providerClient.standard.transitionState(tx.txId, 'DELIVERED', {
    resultHash: '0xabc123...', // Hash of delivered model
    resultUrl: 'ipfs://QmModelHash',
    notes: 'Model trained with 98.5% accuracy',
  });
  console.log(`   State: DELIVERED`);
  console.log(`   Dispute window: 24 hours\n`);

  // STATE 6: SETTLED (requester releases payment)
  console.log('6. Requester releasing payment (SETTLED)...');
  await requesterClient.basic.release(tx.txId);
  console.log(`   State: SETTLED`);
  console.log(`   Payment complete!\n`);

  // Final summary
  const final = await requesterClient.basic.checkStatus(tx.txId);
  console.log('=== Transaction Complete ===');
  console.log(`Final State: ${final.state}`);
  console.log(`Provider Received: $${45.00 - 0.45} USDC`);
  console.log(`Platform Fee: $0.45 USDC (1%)`);
}

main().catch(console.error);
```

#### Dispute Handling (TypeScript)

```typescript
/**
 * AGIRAILS Dispute Handling Example
 *
 * Demonstrates the dispute resolution flow:
 * DELIVERED → DISPUTED → SETTLED (with resolution)
 *
 * Run: npx ts-node dispute-handling.ts
 */

import { ACTPClient, DisputeReason, Resolution } from '@agirails/sdk';

async function main() {
  console.log('=== AGIRAILS Dispute Handling ===\n');

  const client = await ACTPClient.create({
    mode: 'mock',
    requesterAddress: '0x1111111111111111111111111111111111111111',
  });

  // Setup: Create and complete a transaction
  await client.mock.mint('0x1111111111111111111111111111111111111111', 1000);

  const tx = await client.basic.pay({
    to: '0x2222222222222222222222222222222222222222',
    amount: 100.00,
    deadline: '+24h',
  });

  // Provider delivers
  await client.standard.transitionState(tx.txId, 'DELIVERED', {
    resultHash: '0xbadresult...',
  });

  console.log('Transaction delivered, now raising dispute...\n');

  // DISPUTE: Requester is not satisfied
  await client.standard.raiseDispute(tx.txId, {
    reason: DisputeReason.QUALITY_ISSUE,
    description: 'Delivered result does not meet specifications',
    evidence: [
      { type: 'text', content: 'Original spec: 99% accuracy' },
      { type: 'text', content: 'Delivered: 75% accuracy' },
    ],
  });

  console.log('Dispute raised!');
  const disputed = await client.basic.checkStatus(tx.txId);
  console.log(`State: ${disputed.state}`);
  console.log(`Dispute reason: QUALITY_ISSUE\n`);

  // RESOLUTION: Mediator resolves (in production, this is external)
  // For mock mode, we simulate mediator resolution
  console.log('Simulating mediator resolution...\n');

  await client.mock.resolveDispute(tx.txId, {
    resolution: Resolution.PARTIAL_REFUND,
    requesterPercent: 60, // Requester gets 60% back
    providerPercent: 40,  // Provider keeps 40%
    notes: 'Partial delivery acknowledged, proportional split applied',
  });

  // Final state
  const final = await client.basic.checkStatus(tx.txId);
  console.log('=== Dispute Resolved ===');
  console.log(`Final State: ${final.state}`);
  console.log(`Requester refund: $60.00 USDC`);
  console.log(`Provider received: $40.00 USDC`);
}

main().catch(console.error);
```

#### Event Monitoring (TypeScript)

```typescript
/**
 * AGIRAILS Event Monitoring Example
 *
 * Listen for transaction events in real-time.
 * Useful for building dashboards and notifications.
 *
 * Run: npx ts-node event-monitoring.ts
 */

import { ACTPClient, EventType } from '@agirails/sdk';

async function main() {
  console.log('=== AGIRAILS Event Monitoring ===\n');

  const client = await ACTPClient.create({
    mode: 'testnet', // Events work best on testnet/mainnet
    privateKey: process.env.PRIVATE_KEY,
  });

  // Subscribe to all events for your address
  const myAddress = await client.getAddress();

  console.log(`Monitoring events for: ${myAddress}\n`);

  // Listen for specific event types
  client.events.on(EventType.TRANSACTION_CREATED, (event) => {
    console.log('📝 New Transaction');
    console.log(`   ID: ${event.txId}`);
    console.log(`   Amount: ${event.amount} USDC`);
    console.log(`   Provider: ${event.provider}`);
  });

  client.events.on(EventType.ESCROW_LINKED, (event) => {
    console.log('🔒 Escrow Linked');
    console.log(`   ID: ${event.txId}`);
    console.log(`   Locked: ${event.amount} USDC`);
  });

  client.events.on(EventType.STATE_CHANGED, (event) => {
    console.log('🔄 State Changed');
    console.log(`   ID: ${event.txId}`);
    console.log(`   From: ${event.fromState}`);
    console.log(`   To: ${event.toState}`);
  });

  client.events.on(EventType.PAYMENT_RELEASED, (event) => {
    console.log('💰 Payment Released');
    console.log(`   ID: ${event.txId}`);
    console.log(`   Provider received: ${event.amount} USDC`);
  });

  client.events.on(EventType.DISPUTE_RAISED, (event) => {
    console.log('⚠️ Dispute Raised');
    console.log(`   ID: ${event.txId}`);
    console.log(`   Reason: ${event.reason}`);
  });

  // Start listening
  await client.events.startListening({
    fromBlock: 'latest',
    addresses: [myAddress],
  });

  console.log('Listening for events... (Press Ctrl+C to stop)\n');

  // Keep process alive
  await new Promise(() => {});
}

main().catch(console.error);
```

### Step 4: Save to File (Optional)

After generating example:
```
"Save this example to your project?"
Options:
  [Yes - Save to examples/]
  [Yes - Save to src/]
  [No - Just show code]
```

If saving:
```bash
# TypeScript
Write to: examples/agirails-basic-payment.ts

# Python
Write to: examples/agirails_basic_payment.py
```

### Step 5: Next Steps

After generating:
```
Example generated!

To run this example:
1. Install SDK: npm install @agirails/sdk (or pip install agirails)
2. Save the code to a file
3. Run: npx ts-node <filename>.ts (or python <filename>.py)

Try more examples:
- /agirails:example full-lifecycle
- /agirails:example dispute
- /agirails:example events
- /agirails:example agent-integration
```
