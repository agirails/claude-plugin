# Requester Agent Template

Complete template for building an agent that buys services through AGIRAILS.

## Full TypeScript Implementation

```typescript
import { ACTPClient, Transaction, TransactionState } from '@agirails/sdk';
import { ethers } from 'ethers';

interface ServiceRequest {
  providerAddress: string;
  task: any;
  maxBudget: bigint;
  deadline: number; // Unix timestamp
  disputeWindow?: number; // Seconds, default 48h
}

interface CompletedJob {
  txId: string;
  result: any;
  cost: bigint;
  duration: number;
}

export class RequesterAgent {
  private client!: ACTPClient;
  private wallet!: string;
  private pendingRequests: Map<string, ServiceRequest> = new Map();

  // ============================================================
  // INITIALIZATION (SDK handles connection)
  // ============================================================

  async start() {
    // SDK handles: wallet connection, contract initialization
    this.client = await ACTPClient.create({
      mode: (process.env.AGIRAILS_MODE as 'mock' | 'testnet' | 'mainnet') ?? 'testnet',
      privateKey: process.env.AGENT_PRIVATE_KEY!,
      requesterAddress: process.env.AGENT_ADDRESS!,
    });

    this.wallet = await this.client.getAddress();
    console.log(`Requester agent started: ${this.wallet}`);

    // Check balance
    const balance = await this.client.getBalance(this.wallet);
    console.log(`USDC Balance: ${ethers.formatUnits(balance, 6)}`);

    // Start listening for responses
    this.setupEventListeners();
  }

  // ============================================================
  // EVENT HANDLING (SDK provides events, you handle logic)
  // ============================================================

  private setupEventListeners() {
    // Use your own event monitor (ethers) or polling to detect:
    // - StateTransitioned (QUOTED, DELIVERED)
    // - EscrowLinked / EscrowReleased
  }

  // ============================================================
  // REQUEST SERVICE (YOU IMPLEMENT: what to request)
  // ============================================================

  async requestService(request: ServiceRequest): Promise<string> {
    console.log(`Requesting service from ${request.providerAddress}`);

    // 1. SDK HANDLES: Create transaction
    const txId = await this.client.standard.createTransaction({
      provider: request.providerAddress,
      amount: request.maxBudget,
      deadline: request.deadline,
      disputeWindow: request.disputeWindow || 48 * 3600, // 48h default
      serviceDescription: request.task?.description,
    });

    console.log(`Transaction created: ${txId}`);

    // 2. SDK HANDLES: Link escrow (locks funds)
    await this.client.standard.linkEscrow(txId);

    console.log(`Escrow linked, funds locked`);

    // Track pending request
    this.pendingRequests.set(txId, request);

    return txId;
  }

  // ============================================================
  // QUOTE HANDLING (YOU IMPLEMENT: accept/reject logic)
  // ============================================================

  private async onQuoteReceived(tx: Transaction) {
    const request = this.pendingRequests.get(tx.id);
    if (!request) return;

    console.log(`Quote received for ${tx.id}: ${ethers.formatUnits(tx.quotedAmount, 6)} USDC`);

    // YOUR LOGIC: Decide if quote is acceptable
    if (this.isQuoteAcceptable(tx.quotedAmount, request.maxBudget)) {
      // SDK HANDLES: Accept quote by linking escrow with quoted amount
      await this.client.standard.linkEscrow(tx.id);
      console.log(`Quote accepted, waiting for delivery`);
    } else {
      // SDK HANDLES: Cancel if quote too high
      await this.client.standard.transitionState(tx.id, 'CANCELLED');
      console.log(`Quote rejected, transaction cancelled`);
      this.pendingRequests.delete(tx.id);
    }
  }

  // YOUR IMPLEMENTATION: Quote evaluation
  private isQuoteAcceptable(quote: bigint, maxBudget: bigint): boolean {
    // Simple check: quote <= maxBudget
    // You might add more sophisticated logic:
    // - Compare to market rates
    // - Check provider reputation
    // - Consider urgency
    return quote <= maxBudget;
  }

  // ============================================================
  // DELIVERY HANDLING (YOU IMPLEMENT: validation logic)
  // ============================================================

  private async onDelivery(tx: Transaction) {
    console.log(`Delivery received for ${tx.id}`);

    const request = this.pendingRequests.get(tx.id);
    if (!request) return;

    // 1. Fetch the result
    const result = await this.fetchResult(tx.resultUrl);

    // 2. Verify hash matches (protocol also checks this)
    const expectedHash = ethers.keccak256(ethers.toUtf8Bytes(result));
    if (expectedHash !== tx.resultHash) {
      console.log(`Hash mismatch! Raising dispute.`);
      await this.client.standard.transitionState(tx.id, 'DISPUTED');
      return;
    }

    // 3. YOUR LOGIC: Validate result quality
    const validation = await this.validateResult(result, request.task);

    if (validation.passed) {
      // SDK HANDLES: Release payment to provider
      await this.client.standard.releaseEscrow(tx.id);
      console.log(`Payment released for ${tx.id}`);
    } else {
      // SDK HANDLES: Dispute flow (state transition)
      await this.client.standard.transitionState(tx.id, 'DISPUTED');
      console.log(`Dispute raised for ${tx.id}: ${validation.reason}`);
    }
  }

  // YOUR IMPLEMENTATION: Fetch result from URL
  private async fetchResult(resultUrl: string): Promise<string> {
    if (resultUrl.startsWith('ipfs://')) {
      // Fetch from IPFS
      const cid = resultUrl.replace('ipfs://', '');
      return await this.fetchFromIPFS(cid);
    } else {
      // Fetch from HTTP
      const response = await fetch(resultUrl);
      return await response.text();
    }
  }

  // YOUR IMPLEMENTATION: Result validation
  private async validateResult(
    result: string,
    originalTask: any
  ): Promise<{ passed: boolean; reason?: string; evidence?: any }> {
    // Example validation logic:

    // 1. Check result is not empty
    if (!result || result.trim().length === 0) {
      return { passed: false, reason: 'Empty result' };
    }

    // 2. Check result meets minimum length
    if (result.length < originalTask.minLength) {
      return {
        passed: false,
        reason: 'Result too short',
        evidence: { expected: originalTask.minLength, actual: result.length },
      };
    }

    // 3. Check result quality with LLM
    const qualityScore = await this.evaluateQuality(result, originalTask);
    if (qualityScore < 0.7) {
      return {
        passed: false,
        reason: 'Quality below threshold',
        evidence: { score: qualityScore, threshold: 0.7 },
      };
    }

    return { passed: true };
  }

  // YOUR IMPLEMENTATION: Quality evaluation
  private async evaluateQuality(result: string, task: any): Promise<number> {
    // Use LLM or other methods to evaluate quality
    // Return score 0-1
    return 0.9; // Placeholder
  }

  // ============================================================
  // SETTLEMENT (SDK handles, you just track)
  // ============================================================

  private async onSettled(tx: Transaction) {
    const request = this.pendingRequests.get(tx.id);
    if (!request) return;

    console.log(`Transaction settled: ${tx.id}`);
    console.log(`Final cost: ${ethers.formatUnits(tx.amount, 6)} USDC`);

    // YOUR LOGIC: Track completed job, update analytics
    this.pendingRequests.delete(tx.id);
  }

  // ============================================================
  // CANCELLATION (SDK handles refund)
  // ============================================================

  async cancelRequest(txId: string): Promise<void> {
    // SDK HANDLES: Cancel and refund
    // Only works before DELIVERED state
    await this.client.standard.transitionState(txId, 'CANCELLED');

    console.log(`Transaction cancelled: ${txId}`);
    console.log(`Funds refunded to wallet`);

    this.pendingRequests.delete(txId);
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private async fetchFromIPFS(cid: string): Promise<string> {
    // Your IPFS gateway integration
    const gateway = process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/';
    const response = await fetch(`${gateway}${cid}`);
    return await response.text();
  }

  // Get status of pending request
  async getRequestStatus(txId: string): Promise<any> {
    return await this.client.basic.checkStatus(txId);
  }

  // List all pending requests
  getPendingRequests(): Map<string, ServiceRequest> {
    return this.pendingRequests;
  }
}

// ============================================================
// USAGE
// ============================================================

async function main() {
  const agent = new RequesterAgent();
  await agent.start();

  // Request a translation service
  const txId = await agent.requestService({
    providerAddress: '0xProviderAddress...',
    task: {
      type: 'translation',
      text: 'Hello, world!',
      targetLanguage: 'Spanish',
      minLength: 10,
    },
    maxBudget: ethers.parseUnits('5', 6), // $5 USDC max
    deadline: Math.floor(Date.now() / 1000) + 86400, // 24h from now
  });

  console.log(`Request submitted: ${txId}`);
}

main();
```

## Python Implementation

```python
from agirails import ACTPClient
from dataclasses import dataclass
from typing import Optional, Dict, Any
import hashlib
import aiohttp
import asyncio

@dataclass
class ServiceRequest:
    provider_address: str
    task: dict
    max_budget: int
    deadline: int
    dispute_window: int = 48 * 3600

class RequesterAgent:
    def __init__(self):
        self.client: Optional[ACTPClient] = None
        self.wallet: Optional[str] = None
        self.pending_requests: Dict[str, ServiceRequest] = {}

    async def start(self):
        self.client = await ACTPClient.create(
            mode="testnet",
            private_key=os.environ["AGENT_PRIVATE_KEY"],
            requester_address=os.environ["AGENT_ADDRESS"],
        )
        self.wallet = await self.client.get_address()
        # Use your own indexer or polling to detect updates

    async def request_service(self, request: ServiceRequest) -> str:
        # SDK HANDLES: Transaction creation
        tx_id = await self.client.standard.create_transaction(
            provider=request.provider_address,
            amount=request.max_budget,
            deadline=request.deadline,
            dispute_window=request.dispute_window,
            description=request.task.get("description"),
        )

        # SDK HANDLES: Escrow linking
        await self.client.standard.link_escrow(tx_id)

        self.pending_requests[tx_id] = request
        return tx_id

    # YOUR IMPLEMENTATION: Result validation
    async def validate_result(self, result: str, task: dict) -> dict:
        if not result or len(result.strip()) == 0:
            return {"passed": False, "reason": "Empty result"}

        # Add your validation logic
        return {"passed": True}

    async def on_delivery(self, tx):
        result = await self.fetch_result(tx.result_url)
        validation = await self.validate_result(result, tx.metadata)

        if validation["passed"]:
            # SDK HANDLES: Payment release
            await self.client.standard.release_escrow(tx.id)
        else:
            # SDK HANDLES: Dispute flow (state transition)
            await self.client.standard.transition_state(tx.id, "DISPUTED")

    async def fetch_result(self, url: str) -> str:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                return await response.text()
```

## What You Must Implement

| Component | Purpose | Example |
|-----------|---------|---------|
| `requestService()` | Define what you need | Task description, budget |
| `isQuoteAcceptable()` | Evaluate provider's quote | Compare to budget |
| `fetchResult()` | Get deliverable | Download from IPFS |
| `validateResult()` | Check quality | LLM evaluation, hash check |
| `evaluateQuality()` | Score the work | Compare to requirements |

## What SDK Handles

| Component | Description |
|-----------|-------------|
| Transaction creation | On-chain record |
| Escrow locking | Funds secured |
| Quote tracking | State updates |
| Payment release | Funds to provider |
| Dispute raising | Start mediation |
| Cancellation | Refund to requester |
| Event notifications | State changes |

## Decision Flow

```
Request Service
      │
      ▼
Create Transaction ──► SDK handles state machine
      │
      ▼
Link Escrow ──────────► SDK locks USDC
      │
      ▼
Wait for Quote
      │
      ├─► Quote too high? ──► Cancel (SDK refunds)
      │
      └─► Quote OK? ──► Accept (SDK updates escrow)
            │
            ▼
      Wait for Delivery
            │
            ▼
      Validate Result ◄──── YOUR LOGIC
            │
            ├─► Valid? ──► Release (SDK pays provider)
            │
            └─► Invalid? ──► Dispute (SDK starts mediation)
                                │
                                ▼
                        Mediator Resolves
                                │
                                ▼
                        SDK splits funds
```
