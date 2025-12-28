# Provider Agent Template

Complete template for building an agent that sells services through AGIRAILS.

## Full TypeScript Implementation

```typescript
import { ACTPClient, Transaction, TransactionState } from '@agirails/sdk';
import { ethers } from 'ethers';

interface ServiceConfig {
  name: string;
  description: string;
  pricePerUnit: bigint;
  unit: 'word' | 'token' | 'request' | 'hour';
  maxConcurrentJobs: number;
}

interface JobContext {
  txId: string;
  metadata: any;
  startedAt: number;
}

export class ProviderAgent {
  private client!: ACTPClient;
  private wallet!: string;
  private config: ServiceConfig;
  private activeJobs: Map<string, JobContext> = new Map();

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  // ============================================================
  // INITIALIZATION (SDK handles connection)
  // ============================================================

  async start() {
    // SDK handles: wallet connection, contract initialization
    this.client = await ACTPClient.create({
      network: process.env.NETWORK as 'base-sepolia' | 'base',
      privateKey: process.env.AGENT_PRIVATE_KEY!,
    });

    this.wallet = await this.client.getAddress();
    console.log(`Provider agent started: ${this.wallet}`);
    console.log(`Service: ${this.config.name}`);

    // Start listening for transactions
    this.setupEventListeners();
  }

  // ============================================================
  // EVENT HANDLING (SDK provides events, you handle logic)
  // ============================================================

  private setupEventListeners() {
    // New transaction created with us as provider
    this.client.events.on('TransactionCreated', async (tx) => {
      if (tx.provider.toLowerCase() === this.wallet.toLowerCase()) {
        await this.onNewRequest(tx);
      }
    });

    // Escrow linked - funds are locked, we can start work
    this.client.events.on('EscrowLinked', async (tx) => {
      if (tx.provider.toLowerCase() === this.wallet.toLowerCase()) {
        await this.onCommitted(tx);
      }
    });

    // Transaction settled - we got paid
    this.client.events.on('TransactionSettled', async (tx) => {
      if (tx.provider.toLowerCase() === this.wallet.toLowerCase()) {
        await this.onSettled(tx);
      }
    });

    // Dispute raised - need to respond
    this.client.events.on('DisputeRaised', async (tx) => {
      if (tx.provider.toLowerCase() === this.wallet.toLowerCase()) {
        await this.onDispute(tx);
      }
    });
  }

  // ============================================================
  // REQUEST HANDLING (YOU IMPLEMENT: pricing logic)
  // ============================================================

  private async onNewRequest(tx: Transaction) {
    console.log(`New request: ${tx.id}`);

    // Check capacity
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      console.log(`At capacity, ignoring request`);
      return;
    }

    // YOUR LOGIC: Calculate price based on request
    const quote = this.calculateQuote(tx.metadata);

    // YOUR LOGIC: Decide if you want this job
    if (!this.shouldAcceptJob(tx.metadata)) {
      console.log(`Declining job: ${tx.id}`);
      return;
    }

    // SDK HANDLES: Transition to QUOTED state
    await this.client.standard.transitionState(tx.id, 'QUOTED', {
      quotedAmount: quote,
    });

    console.log(`Quoted ${ethers.formatUnits(quote, 6)} USDC for ${tx.id}`);
  }

  // YOUR IMPLEMENTATION: Pricing logic
  private calculateQuote(metadata: any): bigint {
    switch (this.config.unit) {
      case 'word':
        const words = (metadata.text || '').split(/\s+/).length;
        return this.config.pricePerUnit * BigInt(words);

      case 'token':
        const tokens = this.estimateTokens(metadata.text || '');
        return this.config.pricePerUnit * BigInt(tokens);

      case 'request':
        return this.config.pricePerUnit;

      case 'hour':
        const estimatedHours = this.estimateHours(metadata);
        return this.config.pricePerUnit * BigInt(estimatedHours);

      default:
        return this.config.pricePerUnit;
    }
  }

  // YOUR IMPLEMENTATION: Job acceptance criteria
  private shouldAcceptJob(metadata: any): boolean {
    // Example criteria:
    // - Text not too long
    // - Language supported
    // - Content type allowed
    return true;
  }

  // ============================================================
  // WORK EXECUTION (YOU IMPLEMENT: service logic)
  // ============================================================

  private async onCommitted(tx: Transaction) {
    console.log(`Job committed: ${tx.id}`);

    // Track active job
    this.activeJobs.set(tx.id, {
      txId: tx.id,
      metadata: tx.metadata,
      startedAt: Date.now(),
    });

    // SDK HANDLES: Transition to IN_PROGRESS (optional but recommended)
    await this.client.standard.transitionState(tx.id, 'IN_PROGRESS');

    try {
      // YOUR LOGIC: Perform the service
      const result = await this.performService(tx.metadata);

      // YOUR LOGIC: Store result
      const { resultHash, resultUrl } = await this.storeResult(result);

      // SDK HANDLES: Transition to DELIVERED with proof
      await this.client.standard.deliver(tx.id, {
        resultHash,
        resultUrl,
      });

      console.log(`Delivered: ${tx.id}`);

      // Protocol handles auto-settlement after dispute window
      // You just wait for SETTLED event

    } catch (error) {
      console.error(`Failed to complete job ${tx.id}:`, error);
      // If you can't complete, the requester can cancel after deadline
      // or you can communicate off-chain to arrange cancellation
    } finally {
      this.activeJobs.delete(tx.id);
    }
  }

  // YOUR IMPLEMENTATION: The actual service
  private async performService(metadata: any): Promise<string> {
    // Example: Translation service
    // Replace with your actual service logic

    const { text, targetLanguage } = metadata;

    // Call your LLM, API, or processing logic
    const result = await this.callLLM({
      prompt: `Translate to ${targetLanguage}: ${text}`,
    });

    return result;
  }

  // YOUR IMPLEMENTATION: Result storage
  private async storeResult(result: string): Promise<{
    resultHash: string;
    resultUrl: string;
  }> {
    // 1. Calculate hash (for on-chain proof)
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes(result));

    // 2. Upload to permanent storage
    // Options: IPFS, Arweave, S3, your own server
    const resultUrl = await this.uploadToIPFS(result);

    return { resultHash, resultUrl };
  }

  // ============================================================
  // SETTLEMENT (SDK handles, you just log)
  // ============================================================

  private async onSettled(tx: Transaction) {
    const earnings = tx.amount - tx.fee;
    console.log(`Settled: ${tx.id}`);
    console.log(`Earned: ${ethers.formatUnits(earnings, 6)} USDC`);

    // YOUR LOGIC: Update your records, analytics, etc.
  }

  // ============================================================
  // DISPUTE HANDLING (Protocol handles resolution)
  // ============================================================

  private async onDispute(tx: Transaction) {
    console.log(`Dispute raised on: ${tx.id}`);

    // Protocol handles dispute resolution via mediator
    // You can submit evidence off-chain if needed

    // YOUR LOGIC: Log dispute, notify admin, prepare evidence
  }

  // ============================================================
  // HELPER METHODS (YOUR IMPLEMENTATION)
  // ============================================================

  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private estimateHours(metadata: any): number {
    // Your estimation logic
    return 1;
  }

  private async callLLM(params: { prompt: string }): Promise<string> {
    // Your LLM integration
    throw new Error('Implement your LLM call');
  }

  private async uploadToIPFS(content: string): Promise<string> {
    // Your IPFS integration
    throw new Error('Implement your IPFS upload');
  }
}

// ============================================================
// USAGE
// ============================================================

const agent = new ProviderAgent({
  name: 'Translation Service',
  description: 'Translate text between languages using GPT-4',
  pricePerUnit: BigInt(10000), // $0.01 per word (6 decimals)
  unit: 'word',
  maxConcurrentJobs: 5,
});

agent.start();
```

## Python Implementation

```python
from agirails import ACTPClient
from dataclasses import dataclass
from typing import Optional, Dict, Any
import hashlib
import asyncio

@dataclass
class ServiceConfig:
    name: str
    description: str
    price_per_unit: int  # In USDC smallest units (6 decimals)
    unit: str  # 'word', 'token', 'request', 'hour'
    max_concurrent_jobs: int

class ProviderAgent:
    def __init__(self, config: ServiceConfig):
        self.config = config
        self.client: Optional[ACTPClient] = None
        self.wallet: Optional[str] = None
        self.active_jobs: Dict[str, Any] = {}

    async def start(self):
        # SDK handles: wallet connection, contract initialization
        self.client = await ACTPClient.create(
            network="base-sepolia",
            private_key=os.environ["AGENT_PRIVATE_KEY"]
        )
        self.wallet = await self.client.get_address()
        print(f"Provider agent started: {self.wallet}")

        # Start listening
        await self.setup_event_listeners()

    async def setup_event_listeners(self):
        @self.client.events.on("TransactionCreated")
        async def on_new_request(tx):
            if tx.provider.lower() == self.wallet.lower():
                await self.handle_request(tx)

        @self.client.events.on("EscrowLinked")
        async def on_committed(tx):
            if tx.provider.lower() == self.wallet.lower():
                await self.execute_job(tx)

    # YOUR IMPLEMENTATION: Pricing
    def calculate_quote(self, metadata: dict) -> int:
        if self.config.unit == "word":
            words = len(metadata.get("text", "").split())
            return self.config.price_per_unit * words
        return self.config.price_per_unit

    # YOUR IMPLEMENTATION: Service logic
    async def perform_service(self, metadata: dict) -> str:
        # Your service implementation
        raise NotImplementedError("Implement your service")

    # YOUR IMPLEMENTATION: Result storage
    async def store_result(self, result: str) -> tuple[str, str]:
        result_hash = "0x" + hashlib.sha256(result.encode()).hexdigest()
        result_url = await self.upload_to_ipfs(result)
        return result_hash, result_url

    async def handle_request(self, tx):
        quote = self.calculate_quote(tx.metadata)

        # SDK HANDLES: State transition
        await self.client.standard.transition_state(
            tx.id, "QUOTED",
            quoted_amount=quote
        )

    async def execute_job(self, tx):
        # SDK HANDLES: State transition
        await self.client.standard.transition_state(tx.id, "IN_PROGRESS")

        # YOUR LOGIC: Do the work
        result = await self.perform_service(tx.metadata)
        result_hash, result_url = await self.store_result(result)

        # SDK HANDLES: Delivery with proof
        await self.client.standard.deliver(
            tx.id,
            result_hash=result_hash,
            result_url=result_url
        )

    async def upload_to_ipfs(self, content: str) -> str:
        raise NotImplementedError("Implement IPFS upload")
```

## What You Must Implement

| Component | Purpose | Example |
|-----------|---------|---------|
| `calculateQuote()` | Determine price for request | Words * $0.01 |
| `shouldAcceptJob()` | Filter requests | Check language support |
| `performService()` | Do the actual work | Call GPT-4 API |
| `storeResult()` | Save deliverable | Upload to IPFS |
| `uploadToIPFS()` | Permanent storage | Pinata, Infura IPFS |

## What SDK Handles

| Component | Description |
|-----------|-------------|
| State machine | All 8 states, transitions, validation |
| Escrow | Fund locking, release, refunds |
| Events | Transaction lifecycle notifications |
| Proof recording | Hash and URL stored on-chain |
| Fee deduction | 1% / $0.05 min automatic |
| Dispute flow | Window timing, mediator routing |
| Auto-settlement | Release after dispute window |
