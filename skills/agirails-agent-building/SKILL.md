---
description: Use this skill when the user wants to build an AI agent that sells or buys services through AGIRAILS, create a service agent, implement agent-to-agent payments, or integrate ACTP into autonomous agents. This skill clearly separates what the protocol handles from what the developer must implement.
---

# Building Agents with AGIRAILS

This skill provides guidance for building AI agents that participate in the AGIRAILS economy - either as **service providers** (selling services) or **requesters** (buying services).

## Critical: Protocol vs Implementation

**DO NOT ask users to decide things the protocol already defines.**

### ACTP Protocol Handles (Just Use SDK)

These are NOT design decisions. The protocol defines them. Use the SDK.

| Aspect | Protocol Definition | SDK Method |
|--------|---------------------|------------|
| **Escrow** | USDC locked in EscrowVault until delivery | `client.escrow.*` |
| **State Machine** | 8 states, one-way transitions | `client.standard.transitionState()` |
| **Proof of Delivery** | `resultHash` + `resultUrl` + optional EAS attestation | `client.standard.deliver()` |
| **Dispute Resolution** | 48h window, mediator resolves, penalties for false disputes | `client.standard.raiseDispute()` |
| **Fee Collection** | 1% with $0.05 minimum, auto-deducted | Automatic |
| **Auto-Settlement** | After dispute window, funds auto-release to provider | Automatic |
| **Access Control** | Only requester/provider can call specific functions | Enforced by contract |
| **Deadline Enforcement** | Transaction expires if not delivered by deadline | Enforced by contract |

**When user asks "how do I prove delivery?" → Answer: Use `resultHash` + `resultUrl`. That's it.**

**When user asks "what if there's a dispute?" → Answer: Protocol handles it. 48h window, mediator resolves.**

### Developer Must Implement

These are the ONLY things the developer decides:

| Decision | Description | Examples |
|----------|-------------|----------|
| **Service Type** | What does the agent do? | Translation, code review, data analysis |
| **Pricing Logic** | How to calculate price | Fixed rate, per-token, per-hour |
| **Request Interface** | How clients reach the agent | REST API, WebSocket, on-chain events |
| **Execution Logic** | How to perform the service | Call LLM, run code, fetch data |
| **Result Storage** | Where to store deliverables | IPFS, Arweave, S3, own server |
| **Hosting** | Where agent runs | Cloud VM, serverless, decentralized |

## Agent Architecture

### Provider Agent (Sells Services)

```
┌─────────────────────────────────────────────────────────────┐
│  PROVIDER AGENT                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  YOU IMPLEMENT:                        SDK HANDLES:         │
│  ┌─────────────────────┐              ┌─────────────────┐   │
│  │ 1. Request Handler  │              │ State machine   │   │
│  │    (API endpoint)   │              │ Escrow mgmt     │   │
│  │                     │              │ Fee deduction   │   │
│  │ 2. Pricing Logic    │              │ Dispute flow    │   │
│  │    (calculate fee)  │              │ Auto-settle     │   │
│  │                     │              │ Access control  │   │
│  │ 3. Service Logic    │              │ Deadlines       │   │
│  │    (do the work)    │              │ Attestations    │   │
│  │                     │              │                 │   │
│  │ 4. Result Storage   │              │                 │   │
│  │    (upload to IPFS) │              │                 │   │
│  └─────────────────────┘              └─────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Requester Agent (Buys Services)

```
┌─────────────────────────────────────────────────────────────┐
│  REQUESTER AGENT                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  YOU IMPLEMENT:                        SDK HANDLES:         │
│  ┌─────────────────────┐              ┌─────────────────┐   │
│  │ 1. Provider Discovery│             │ Transaction     │   │
│  │    (find who to pay) │             │   creation      │   │
│  │                      │             │ Escrow locking  │   │
│  │ 2. Request Creation  │             │ State tracking  │   │
│  │    (what to ask for) │             │ Auto-release    │   │
│  │                      │             │ Dispute raising │   │
│  │ 3. Result Validation │             │ Refund on       │   │
│  │    (check quality)   │             │   cancel        │   │
│  │                      │             │                 │   │
│  │ 4. Release Decision  │             │                 │   │
│  │    (approve or not)  │             │                 │   │
│  └─────────────────────┘              └─────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Minimal Provider Agent (TypeScript)

```typescript
import { ACTPClient } from '@agirails/sdk';

class ServiceAgent {
  private client: ACTPClient;
  private wallet: string;

  async initialize() {
    this.client = await ACTPClient.create({
      network: 'base-sepolia', // or 'base' for mainnet
      privateKey: process.env.AGENT_PRIVATE_KEY!,
    });
    this.wallet = await this.client.getAddress();
  }

  // 1. Listen for incoming transactions (YOU IMPLEMENT: how to receive)
  async startListening() {
    this.client.events.on('TransactionCreated', async (tx) => {
      if (tx.provider === this.wallet) {
        await this.handleRequest(tx);
      }
    });
  }

  // 2. Handle request (YOU IMPLEMENT: pricing logic)
  async handleRequest(tx: Transaction) {
    // YOUR LOGIC: Decide if you want this job and at what price
    const quote = this.calculatePrice(tx.metadata);

    // SDK HANDLES: State transition to QUOTED
    await this.client.standard.transitionState(tx.id, 'QUOTED', {
      quotedAmount: quote,
    });
  }

  // 3. Do the work when committed (YOU IMPLEMENT: service logic)
  async onCommitted(tx: Transaction) {
    // YOUR LOGIC: Perform the actual service
    const result = await this.performService(tx.metadata);

    // YOUR LOGIC: Store result somewhere accessible
    const resultUrl = await this.uploadToIPFS(result);
    const resultHash = this.hashContent(result);

    // SDK HANDLES: State transition to DELIVERED with proof
    await this.client.standard.deliver(tx.id, {
      resultHash,
      resultUrl,
    });

    // SDK HANDLES: Auto-settlement after dispute window
    // You just wait for SETTLED event
  }

  // YOUR IMPLEMENTATION
  private calculatePrice(metadata: any): bigint {
    // Example: $0.01 per word
    const words = metadata.text?.split(' ').length || 0;
    return BigInt(words * 10000); // USDC has 6 decimals
  }

  // YOUR IMPLEMENTATION
  private async performService(metadata: any): Promise<string> {
    // Example: Translate text using LLM
    return await this.llm.translate(metadata.text, metadata.targetLang);
  }

  // YOUR IMPLEMENTATION
  private async uploadToIPFS(content: string): Promise<string> {
    // Upload to IPFS, return URL
    return `ipfs://${await ipfs.add(content)}`;
  }

  // YOUR IMPLEMENTATION
  private hashContent(content: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(content));
  }
}
```

## Minimal Requester Agent (TypeScript)

```typescript
import { ACTPClient } from '@agirails/sdk';

class RequesterAgent {
  private client: ACTPClient;

  async initialize() {
    this.client = await ACTPClient.create({
      network: 'base-sepolia',
      privateKey: process.env.AGENT_PRIVATE_KEY!,
    });
  }

  // Request a service from another agent
  async requestService(providerAddress: string, task: any) {
    // 1. Create transaction (SDK handles state machine)
    const txId = await this.client.kernel.createTransaction({
      provider: providerAddress,
      amount: task.maxBudget,
      deadline: Math.floor(Date.now() / 1000) + 86400, // 24h
      metadata: task,
    });

    // 2. Link escrow (SDK handles fund locking)
    await this.client.escrow.link(txId);

    // 3. Wait for delivery (SDK handles state tracking)
    const result = await this.waitForDelivery(txId);

    // 4. Validate and release (YOU IMPLEMENT: quality check)
    if (this.validateResult(result)) {
      await this.client.basic.release(txId);
      return result;
    } else {
      // SDK HANDLES: Dispute flow
      await this.client.standard.raiseDispute(txId, {
        reason: 'Result does not meet requirements',
      });
    }
  }

  // YOUR IMPLEMENTATION
  private validateResult(result: any): boolean {
    // Check if result meets your requirements
    return result.quality >= 0.8;
  }
}
```

## Common Mistakes to Avoid

### WRONG: Asking users about protocol mechanics

```
❌ "How do you want to handle escrow?"
❌ "What dispute mechanism should we use?"
❌ "How will you prove delivery?"
❌ "What fee model do you want?"
```

### RIGHT: Asking about their service

```
✓ "What service does your agent provide?"
✓ "How should pricing be calculated?"
✓ "Where will you host the agent?"
✓ "How will clients discover your agent?"
```

## Checklist for Building an Agent

### Provider Agent Checklist

- [ ] **Wallet**: Agent has private key for receiving payments
- [ ] **SDK Initialized**: `ACTPClient.create()` with credentials
- [ ] **Event Listener**: Watching for `TransactionCreated` events
- [ ] **Pricing Logic**: Function to calculate quote for requests
- [ ] **Service Logic**: Function to perform the actual work
- [ ] **Result Storage**: Upload mechanism (IPFS, Arweave, etc.)
- [ ] **Delivery Call**: `client.standard.deliver()` with hash + URL

### Requester Agent Checklist

- [ ] **Wallet**: Agent has private key and USDC balance
- [ ] **SDK Initialized**: `ACTPClient.create()` with credentials
- [ ] **Provider Discovery**: Method to find suitable providers
- [ ] **Transaction Creation**: `client.kernel.createTransaction()`
- [ ] **Escrow Linking**: `client.escrow.link()` to lock funds
- [ ] **Result Validation**: Logic to check delivered work
- [ ] **Release/Dispute**: Decision to release or dispute

## FAQ

### Q: How do I handle payment failures?

**A:** The protocol handles this. If provider doesn't deliver before deadline, requester can cancel and get refund. Use `client.basic.cancel()`.

### Q: What if the provider delivers bad work?

**A:** Raise a dispute within the dispute window (default 48h). The mediator will resolve and split funds accordingly. Use `client.standard.raiseDispute()`.

### Q: How do I set my fee?

**A:** You set the price in your quote. The protocol takes 1% (min $0.05) automatically. You receive `amount - fee`.

### Q: Do I need to implement escrow?

**A:** No. The SDK handles escrow completely. Just call `linkEscrow()` and funds are locked. Call `deliver()` and funds are released after dispute window.

### Q: How do I prove I did the work?

**A:** Provide `resultHash` (hash of your output) and `resultUrl` (where to access it). The protocol records these on-chain. For extra proof, use EAS attestation.

## Related Skills

- `agirails-core` - Full protocol specification
- `agirails-typescript` - TypeScript SDK reference
- `agirails-python` - Python SDK reference
- `agirails-security` - Production security checklist
