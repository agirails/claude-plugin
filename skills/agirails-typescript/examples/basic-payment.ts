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

import { ACTPClient, IMockRuntime } from '@agirails/sdk';
import { ethers } from 'ethers';

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
  console.log('   Client created in mock mode');
  console.log(`   Address: ${client.getAddress()}\n`);

  // 2. Check initial balance and mint if needed
  console.log('2. Checking balance...');
  let balance = await client.getBalance(REQUESTER_ADDRESS);
  console.log(`   Balance: ${balance} wei`);

  // 3. Mint test USDC if needed (mock mode only)
  if (BigInt(balance) < BigInt('100000000')) { // Less than 100 USDC
    console.log('   Balance low, minting 1000 USDC...');
    await client.mintTokens(REQUESTER_ADDRESS, '1000000000'); // 1000 * 10^6
    balance = await client.getBalance(REQUESTER_ADDRESS);
    console.log(`   New balance: ${balance} wei\n`);
  } else {
    console.log('');
  }

  // 4. Create a payment using Basic API
  console.log('3. Creating payment...');
  const result = await client.basic.pay({
    to: PROVIDER_ADDRESS,
    amount: 25.00,
    deadline: '+24h',
  });

  console.log('   Payment created!');
  console.log(`   Transaction ID: ${result.txId}`);
  console.log(`   State: ${result.state}`);
  console.log(`   Amount: ${result.amount}`);
  console.log(`   Deadline: ${result.deadline}\n`);

  // 5. Check status using Basic API
  console.log('4. Checking status...');
  const status = await client.basic.checkStatus(result.txId);
  console.log(`   Current state: ${status.state}`);
  console.log(`   Can accept: ${status.canAccept}`);
  console.log(`   Can complete: ${status.canComplete}`);
  console.log(`   Can dispute: ${status.canDispute}\n`);

  // 6. Provider delivers (using Standard API for state transition)
  console.log('5. Provider delivering...');
  await client.standard.transitionState(result.txId, 'IN_PROGRESS');
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const proof = abiCoder.encode(['uint256'], [172800]); // 2 days
  await client.standard.transitionState(result.txId, 'DELIVERED', proof);
  console.log('   State transitioned to DELIVERED\n');

  // 7. Check updated status
  console.log('6. Checking updated status...');
  const updatedStatus = await client.basic.checkStatus(result.txId);
  console.log(`   Current state: ${updatedStatus.state}`);
  console.log(`   Can dispute: ${updatedStatus.canDispute}\n`);

  // 8. Release payment (using Standard API)
  // escrowId equals txId in current implementation
  console.log('7. Releasing payment...');
  await (client.advanced as IMockRuntime).time.advanceTime(172801); // 2 days + 1s
  await client.standard.releaseEscrow(result.txId);
  console.log('   Payment released to provider!\n');

  // 9. Final status
  console.log('8. Final status...');
  const finalStatus = await client.basic.checkStatus(result.txId);
  console.log(`   State: ${finalStatus.state}`);
  console.log(`   Transaction complete!\n`);

  // 10. Check final balance
  console.log('9. Final balance...');
  const finalBalance = await client.getBalance(REQUESTER_ADDRESS);
  console.log(`   Balance: ${finalBalance} wei`);
  console.log(`   (Paid 25 USDC + platform fee)\n`);

  console.log('=== Example Complete ===');
}

main().catch(console.error);
