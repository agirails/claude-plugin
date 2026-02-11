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

import { ACTPClient, IMockRuntime } from '@agirails/sdk';
import { ethers } from 'ethers';

// Configuration
const PROVIDER_ADDRESS = '0x2222222222222222222222222222222222222222';
const PAYMENT_AMOUNT = 10.00; // USDC

async function main() {
  console.log('=== AGIRAILS Basic Payment ===\n');

  // 1. Create client in mock mode (no real funds needed)
  const client = await ACTPClient.create({ mode: 'mock' });
  const myAddress = await client.getAddress();
  console.log('✓ Client created in mock mode\n');

  // 2. Mint test USDC (mock mode only)
  // Mint uses USDC wei (6 decimals): 1000 USDC = 1_000_000_000
  await client.mintTokens(myAddress, '1000000000');
  const balance = await client.getBalance(myAddress);
  console.log(`✓ Balance (wei): ${balance}\n`);

  // 3. Create payment
  const result = await client.basic.pay({
    to: PROVIDER_ADDRESS,
    amount: PAYMENT_AMOUNT,
    deadline: '+24h',
  });
  console.log('✓ Payment created');
  console.log(`  Transaction ID: ${result.txId}`);
  console.log(`  State: ${result.state}`);
  console.log('');

  // 4. Simulate provider delivering (in production, provider calls this)
  // IN_PROGRESS is REQUIRED before DELIVERED
  await client.standard.transitionState(result.txId, 'IN_PROGRESS');
  // DELIVERED requires ABI-encoded dispute window proof
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const proof = abiCoder.encode(['uint256'], [172800]); // 2 days
  await client.standard.transitionState(result.txId, 'DELIVERED', proof);
  console.log('✓ Provider delivered\n');

  // 5. Release payment (after dispute window)
  await (client.advanced as IMockRuntime).time.advanceTime(172801); // 2 days + 1s
  await client.standard.releaseEscrow(result.txId);
  console.log('✓ Payment released to provider\n');

  // 6. Verify final state
  const status = await client.basic.checkStatus(result.txId);
  console.log(`Final state: ${status.state}\n`);

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
from eth_abi import encode
from agirails import ACTPClient

# Configuration
REQUESTER_ADDRESS = "0x1111111111111111111111111111111111111111"
PROVIDER_ADDRESS = "0x2222222222222222222222222222222222222222"
PAYMENT_AMOUNT = 10.00  # USDC


async def main():
    print("=== AGIRAILS Basic Payment ===\n")

    # 1. Create client in mock mode (no real funds needed)
    client = await ACTPClient.create(mode="mock")
    my_address = await client.get_address()
    print("✓ Client created in mock mode\n")

    # 2. Mint test USDC (mock mode only)
    # Mint uses USDC amount (will be converted to wei)
    await client.mint_tokens(my_address, 1000)
    balance = await client.get_balance(my_address)
    print(f"✓ Balance: {balance} USDC\n")

    # 3. Create payment
    result = await client.basic.pay({
        "to": PROVIDER_ADDRESS,
        "amount": PAYMENT_AMOUNT,
        "deadline": "24h",
        "description": "AI code review service",
    })
    print("✓ Payment created")
    print(f"  Transaction ID: {result.tx_id}")
    print(f"  State: {result.state}")
    print("")

    # 4. Simulate provider delivering
    # IN_PROGRESS is REQUIRED before DELIVERED
    await client.standard.transition_state(result.tx_id, "IN_PROGRESS")
    # DELIVERED requires ABI-encoded dispute window proof
    proof = "0x" + encode(["uint256"], [172800]).hex()  # 2 days
    await client.standard.transition_state(result.tx_id, "DELIVERED", proof)
    print("✓ Provider delivered\n")

    # 5. Release payment (after dispute window)
    await client.runtime.time.advance_time(172801)  # 2 days + 1s
    await client.standard.release_escrow(result.tx_id)
    print("✓ Payment released to provider\n")

    # 6. Verify final state
    status = await client.basic.check_status(result.tx_id)
    print(f"Final state: {status.state}\n")

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

import { ACTPClient, IMockRuntime } from '@agirails/sdk';
import { ethers } from 'ethers';

const REQUESTER = '0x1111111111111111111111111111111111111111';
const PROVIDER = '0x2222222222222222222222222222222222222222';

async function main() {
  console.log('=== AGIRAILS Full Transaction Lifecycle ===\n');

  // Create clients for both parties (mock mode assigns random addresses)
  const requesterClient = await ACTPClient.create({ mode: 'mock' });
  const REQUESTER = await requesterClient.getAddress();

  const providerClient = await ACTPClient.create({ mode: 'mock' });
  const PROVIDER = await providerClient.getAddress();

  // Mint tokens (USDC wei): 1000 USDC = 1_000_000_000
  await requesterClient.mintTokens(REQUESTER, '1000000000');

  // STATE 1: INITIATED
  console.log('1. Creating transaction (INITIATED)...');
  const txId = await requesterClient.standard.createTransaction({
    provider: PROVIDER,
    amount: '50.00',
    deadline: '+48h',
    disputeWindow: 86400,
    serviceDescription: 'Custom AI model training',
  });
  console.log(`   State: INITIATED`);
  console.log(`   Transaction ID: ${txId}\n`);

  // STATE 2: QUOTED (optional - provider can quote different price)
  console.log('2. Provider submitting quote (QUOTED)...');
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const quoteProof = abiCoder.encode(['uint256'], [50000000n]); // $50 in USDC (6 decimals)
  await providerClient.standard.transitionState(txId, 'QUOTED', quoteProof);
  console.log(`   State: QUOTED`);
  console.log(`   Quoted amount: $50.00\n`);

  // STATE 3: COMMITTED (requester accepts, escrow linked)
  console.log('3. Requester accepting quote (COMMITTED)...');
  await requesterClient.standard.linkEscrow(txId);
  console.log(`   State: COMMITTED`);
  console.log(`   Escrow linked, funds locked\n`);

  // STATE 4: IN_PROGRESS (provider signals work started - REQUIRED before DELIVERED)
  console.log('4. Provider starting work (IN_PROGRESS)...');
  await providerClient.standard.transitionState(txId, 'IN_PROGRESS');
  console.log(`   State: IN_PROGRESS\n`);

  // Simulate progress updates
  for (const progress of [25, 50, 75, 100]) {
    await new Promise(r => setTimeout(r, 500));
    console.log(`   Progress: ${progress}%`);
  }
  console.log();

  // STATE 5: DELIVERED (provider completes work)
  console.log('5. Provider delivering result (DELIVERED)...');
  const deliveryProof = abiCoder.encode(['uint256'], [86400]); // 24h dispute window
  await providerClient.standard.transitionState(txId, 'DELIVERED', deliveryProof);
  console.log(`   State: DELIVERED`);
  console.log(`   Dispute window: 24 hours\n`);

  // STATE 6: SETTLED (requester releases payment)
  console.log('6. Requester releasing payment (SETTLED)...');
  await (requesterClient.advanced as IMockRuntime).time.advanceTime(86401); // 24h + 1s
  await requesterClient.standard.releaseEscrow(txId);
  console.log(`   State: SETTLED`);
  console.log(`   Payment complete!\n`);

  // Final summary
  const final = await requesterClient.basic.checkStatus(txId);
  console.log('=== Transaction Complete ===');
  console.log(`Final State: ${final.state}`);
  console.log(`Provider Received: $${50.00 - 0.50} USDC`);
  console.log(`Platform Fee: $0.50 USDC (1%)`);
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

import { ACTPClient } from '@agirails/sdk';
import { ethers } from 'ethers';

async function main() {
  console.log('=== AGIRAILS Dispute Handling ===\n');

  const client = await ACTPClient.create({ mode: 'mock' });
  const myAddress = await client.getAddress();

  // Setup: Create and complete a transaction
  // Mint uses USDC wei (6 decimals): 1000 USDC = 1_000_000_000
  await client.mintTokens(myAddress, '1000000000');

  const result = await client.basic.pay({
    to: '0x2222222222222222222222222222222222222222',
    amount: 100.00,
    deadline: '+24h',
  });

  // Provider delivers (IN_PROGRESS then DELIVERED)
  await client.standard.transitionState(result.txId, 'IN_PROGRESS');
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const proof = abiCoder.encode(['uint256'], [172800]); // 2 days
  await client.standard.transitionState(result.txId, 'DELIVERED', proof);

  console.log('Transaction delivered, now raising dispute...\n');

  // DISPUTE: Requester is not satisfied (state transition)
  await client.standard.transitionState(result.txId, 'DISPUTED');

  console.log('Dispute raised!');
  const disputed = await client.basic.checkStatus(result.txId);
  console.log(`State: ${disputed.state}`);
  console.log(`Dispute reason: QUALITY_ISSUE\n`);

  // RESOLUTION: Mediator resolves (in production, this is external)
  // In mock mode, simulate resolution by settling the dispute
  console.log('Simulating mediator resolution...\n');
  const mediator = '0x3333333333333333333333333333333333333333';
  const resolutionProof = abiCoder.encode(
    ['uint256', 'uint256', 'address', 'uint256'],
    [60000000n, 40000000n, mediator, 0n]
  );
  await client.standard.transitionState(result.txId, 'SETTLED', resolutionProof);

  // Final state
  const final = await client.basic.checkStatus(result.txId);
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
 * AGIRAILS State Polling Example
 *
 * The TypeScript SDK does not expose a high-level events API yet.
 * Use polling or subscribe to on-chain events via ethers.
 *
 * Run: npx ts-node state-polling.ts
 */

import { ACTPClient } from '@agirails/sdk';

const TERMINAL = new Set(['SETTLED', 'CANCELLED']);

async function main() {
  // Keystore auto-detect: uses .actp/keystore.json + ACTP_KEY_PASSWORD
  const client = await ACTPClient.create({
    mode: 'testnet', // or 'mainnet'
  });

  const txId = '0xYourTransactionId';
  let lastState = '';

  while (true) {
    const status = await client.basic.checkStatus(txId);
    if (status.state !== lastState) {
      console.log(`[${new Date().toISOString()}] ${lastState} → ${status.state}`);
      lastState = status.state;
    }

    if (TERMINAL.has(status.state)) {
      console.log('✅ Transaction complete');
      break;
    }

    await new Promise((r) => setTimeout(r, 5000));
  }
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
