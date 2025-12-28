/**
 * AGIRAILS SDK - Basic Payment Example
 *
 * Run: npx ts-node basic-payment.ts
 *
 * This example demonstrates:
 * - Creating an ACTPClient in mock mode
 * - Making a simple payment
 * - Checking transaction status
 * - Releasing payment
 */

import { ACTPClient, InsufficientBalanceError } from '@agirails/sdk';

// Addresses (any valid Ethereum addresses for mock mode)
const REQUESTER_ADDRESS = '0x1111111111111111111111111111111111111111';
const PROVIDER_ADDRESS = '0x2222222222222222222222222222222222222222';

async function main() {
  console.log('=== AGIRAILS Basic Payment Example ===\n');

  // 1. Create client in mock mode (no real blockchain needed)
  console.log('1. Creating client...');
  const client = await ACTPClient.create({
    mode: 'mock',
    requesterAddress: REQUESTER_ADDRESS,
  });
  console.log('   Client created in mock mode\n');

  // 2. Check initial balance
  console.log('2. Checking balance...');
  let balance = await client.basic.getBalance();
  console.log(`   Balance: ${balance} USDC`);

  // 3. Mint test USDC if needed
  if (parseFloat(balance) < 100) {
    console.log('   Balance low, minting 1000 USDC...');
    await client.mock.mint(REQUESTER_ADDRESS, 1000);
    balance = await client.basic.getBalance();
    console.log(`   New balance: ${balance} USDC\n`);
  } else {
    console.log('');
  }

  // 4. Create a payment
  console.log('3. Creating payment...');
  try {
    const result = await client.basic.pay({
      to: PROVIDER_ADDRESS,
      amount: '25.00',
      deadline: '+24h',
      serviceDescription: 'AI image generation service',
    });

    console.log('   Payment created!');
    console.log(`   Transaction ID: ${result.txId}`);
    console.log(`   State: ${result.state}`);
    console.log(`   Amount: ${result.amount} USDC`);
    console.log(`   Fee: ${result.fee} USDC`);
    console.log(`   Deadline: ${result.deadline.toISOString()}\n`);

    // 5. Check status
    console.log('4. Checking status...');
    const status = await client.basic.checkStatus(result.txId);
    console.log(`   Current state: ${status.state}`);
    console.log(`   Can release: ${status.canRelease}`);
    console.log(`   Can dispute: ${status.canDispute}`);
    console.log(`   Can cancel: ${status.canCancel}\n`);

    // 6. Simulate provider delivering (in real app, provider does this)
    console.log('5. Simulating delivery...');
    // In mock mode, we can transition directly
    await client.standard.transitionState(result.txId, 'DELIVERED', {
      resultHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      resultUrl: 'ipfs://QmExample...',
    });
    console.log('   Provider marked as DELIVERED\n');

    // 7. Check status again
    console.log('6. Checking updated status...');
    const updatedStatus = await client.basic.checkStatus(result.txId);
    console.log(`   Current state: ${updatedStatus.state}`);
    console.log(`   Can release: ${updatedStatus.canRelease}`);
    console.log(`   Time to auto-settle: ${updatedStatus.timeToAutoSettle}\n`);

    // 8. Release payment
    if (updatedStatus.canRelease) {
      console.log('7. Releasing payment...');
      await client.basic.release(result.txId);
      console.log('   Payment released to provider!\n');
    }

    // 9. Final status
    console.log('8. Final status...');
    const finalStatus = await client.basic.checkStatus(result.txId);
    console.log(`   State: ${finalStatus.state}`);
    console.log(`   Is terminal: ${finalStatus.isTerminal}\n`);

    // 10. Check final balance
    console.log('9. Final balance...');
    const finalBalance = await client.basic.getBalance();
    console.log(`   Balance: ${finalBalance} USDC`);
    console.log(`   (Started with ${balance}, paid 25 + fee)\n`);

  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      console.log(`   Error: Insufficient balance`);
      console.log(`   Need: ${error.required} USDC`);
      console.log(`   Have: ${error.available} USDC`);
    } else {
      throw error;
    }
  }

  console.log('=== Example Complete ===');
}

main().catch(console.error);
