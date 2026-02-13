---
description: Use this skill when the user wants to build an AI agent that sells or buys services through AGIRAILS, create a service agent, implement agent-to-agent payments, build an x402 provider, set pricing, or integrate ACTP into autonomous agents. This skill clearly separates what the protocol handles from what the developer must implement, and covers all API levels from one-liners to full ACTPClient control.
---

# Building Agents with AGIRAILS (v3.0)

This skill provides guidance for building AI agents that participate in the AGIRAILS economy - either as **service providers** (selling services), **requesters** (buying services), or **full autonomous agents** (both earning and paying).

## Quickstart: provide() and request()

The simplest way to build an agent. No boilerplate, no class hierarchy.

### Provider Agent in 3 Lines

```typescript
import { provide } from '@agirails/sdk';

provide('translation', async (job) => {
  const result = await translate(job.input.text, job.input.lang);
  return { output: result, confidence: 0.95 };
});
```

### Requester in 1 Line

```typescript
import { request } from '@agirails/sdk';

const result = await request('translation', {
  input: { text: 'Hello', lang: 'es' },
  budget: 1.00,
});
// result.output = "Hola"
```

That's it. The SDK handles wallet setup (keystore auto-detect), escrow, state transitions, fee deduction, and settlement.

## Agent Class (Recommended for Production)

For agents with multiple capabilities, structured pricing, and lifecycle management:

```typescript
import { Agent } from '@agirails/sdk';

// Constructor takes a single AgentConfig object
const agent = new Agent({
  name: 'translator-pro',
  network: 'testnet',
  behavior: { concurrency: 3, autoAccept: true },
});

// Register services AFTER construction via agent.provide()
agent.provide('translation', async (job) => {
  const translated = await translate(job.input.text, job.input.lang);
  return { output: translated };
});

agent.provide('summarization', async (job) => {
  const summary = await summarize(job.input.text);
  return { output: summary };
});

await agent.start(); // begins listening for jobs
```

**Agent class benefits:**
- Multiple services per agent (via `agent.provide()`)
- Structured pricing models (via `ServiceConfig`)
- Lifecycle management (start/stop)
- Built-in adapter routing (ACTP + x402)
- Discovery integration (Agent Card, ERC-8004)

## Pricing Model

```
cost + margin = price

Provider sets price in QUOTED state:
- Fixed rate: $2.00 per task
- Per-unit: $0.01 per word
- Dynamic: based on complexity analysis

Requester can:
- Accept -> COMMITTED (funds locked in escrow)
- Counter-offer -> new INITIATED with lower amount
- Reject -> CANCELLED (no funds moved)

Fee: max(amount * 1%, $0.05) -- auto-deducted from provider's payment
```

Example pricing logic:

```typescript
agent.provide('code-review', async (job) => {
  // Dynamic pricing based on code size
  const lines = job.input.code.split('\n').length;
  const price = Math.max(lines * 0.01, 0.50); // $0.01/line, min $0.50

  // Return quote (SDK handles QUOTED state transition)
  const review = await reviewCode(job.input.code);
  return { output: review, price };
});
```

## Critical: Protocol vs Implementation

**DO NOT ask users to decide things the protocol already defines.**

### ACTP Protocol Handles (Just Use SDK)

These are NOT design decisions. The protocol defines them. Use the SDK.

| Aspect | Protocol Definition | SDK Method |
|--------|---------------------|------------|
| **Escrow** | USDC locked in EscrowVault until delivery | `client.standard.linkEscrow()` / `releaseEscrow()` |
| **State Machine** | 8 states, one-way transitions | `client.standard.transitionState()` |
| **Proof of Delivery** | ABI-encoded disputeWindow proof + optional EAS attestation | `client.standard.transitionState(txId, 'DELIVERED', proof)` |
| **Dispute Resolution** | 48h window, mediator resolves, penalties for false disputes | `client.standard.transitionState(txId, 'DISPUTED')` |
| **Fee Collection** | 1% with $0.05 minimum, auto-deducted | Automatic |
| **Settlement** | After dispute window expires, call `releaseEscrow()` to settle | `client.standard.releaseEscrow(escrowId)` |
| **Access Control** | Only requester/provider can call specific functions | Enforced by contract |
| **Deadline Enforcement** | Transaction expires if not delivered by deadline | Enforced by contract |

**When user asks "how do I prove delivery?" -> Answer: Use ABI-encoded proof with disputeWindow, optionally with EAS attestation UID.**

**When user asks "what if there's a dispute?" -> Answer: Protocol handles it. 48h window, mediator resolves.**

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
+---------------------------------------------------------------+
|  PROVIDER AGENT                                                |
+---------------------------------------------------------------+
|                                                                |
|  YOU IMPLEMENT:                        SDK HANDLES:            |
|  +-------------------------+          +-------------------+    |
|  | 1. Request Handler      |          | State machine     |    |
|  |    (API endpoint)       |          | Escrow mgmt       |    |
|  |                         |          | Fee deduction      |    |
|  | 2. Pricing Logic        |          | Dispute flow       |    |
|  |    (calculate fee)      |          | Auto-settle        |    |
|  |                         |          | Access control     |    |
|  | 3. Service Logic        |          | Deadlines          |    |
|  |    (do the work)        |          | Attestations       |    |
|  |                         |          | Adapter routing    |    |
|  | 4. Result Storage       |          |                    |    |
|  |    (upload to IPFS)     |          |                    |    |
|  +-------------------------+          +-------------------+    |
|                                                                |
+---------------------------------------------------------------+
```

### Requester Agent (Buys Services)

```
+---------------------------------------------------------------+
|  REQUESTER AGENT                                               |
+---------------------------------------------------------------+
|                                                                |
|  YOU IMPLEMENT:                        SDK HANDLES:            |
|  +-------------------------+          +-------------------+    |
|  | 1. Provider Discovery   |          | Transaction       |    |
|  |    (find who to pay)    |          |   creation        |    |
|  |                         |          | Escrow locking    |    |
|  | 2. Request Creation     |          | State tracking    |    |
|  |    (what to ask for)    |          | Escrow release    |    |
|  |                         |          | Dispute raising   |    |
|  | 3. Result Validation    |          | Refund on         |    |
|  |    (check quality)      |          |   cancel          |    |
|  |                         |          | Adapter routing   |    |
|  | 4. Release Decision     |          |                   |    |
|  |    (approve or not)     |          |                   |    |
|  +-------------------------+          +-------------------+    |
|                                                                |
+---------------------------------------------------------------+
```

## Key Management

No more `privateKey` / `requesterAddress` parameters. The SDK uses keystore auto-detect by default.

```typescript
// Keystore auto-detect (recommended, 90% of users)
// SDK checks: ACTP_PRIVATE_KEY env -> .actp/keystore.json + ACTP_KEY_PASSWORD
const client = await ACTPClient.create({ mode: 'testnet' });

// BYOW (Bring Your Own Wallet)
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.ACTP_PRIVATE_KEY,
});

// Auto-wallet (Smart Wallet + Paymaster)
const client = await ACTPClient.create({
  mode: 'testnet',
  wallet: 'auto',
});
```

For `provide()` and `request()`, keystore auto-detect is always used. No configuration needed.

## x402 Payments (Client-Side)

Pay any x402-enabled HTTP endpoint with instant settlement. No escrow, no state machine.

```typescript
import { ACTPClient } from '@agirails/sdk';

const client = await ACTPClient.create({ mode: 'testnet' });

// Pay an x402 endpoint — adapter routing auto-detects HTTPS URLs
const result = await client.basic.pay({
  to: 'https://api.example.com/generate',
  amount: 0.10,
});
// result.response contains the HTTP response from the endpoint
```

**Note:** The SDK provides x402 client support (`X402Adapter`). x402 server implementation is outside SDK scope — use any HTTP framework with x402 payment headers.

**When to use x402 vs ACTP:**
- x402: API calls, pay-per-request, < $5, no disputes needed
- ACTP: Complex jobs, > $5, need escrow/disputes/deadlines

## Full Agent Template (SOUL Pattern)

An autonomous agent that can both **earn** (provide services) AND **pay** (request sub-tasks). This is the SOUL pattern -- a self-sustaining agent.

```typescript
import { Agent } from '@agirails/sdk';

const agent = new Agent({
  name: 'research-assistant',
  network: 'testnet',
  behavior: { concurrency: 3 },
});

// Earn: provide research service
agent.provide('research', async (job) => {
  // Pay for sub-tasks using x402 (cheap API call)
  const data = await agent.request('web-scraping', {
    input: { url: job.input.url },
    budget: 0.50,
  });

  // Pay for analysis using ACTP (complex job)
  const analysis = await agent.request('data-analysis', {
    input: { data: data.output },
    budget: 2.00,
  });

  const summary = await summarize(analysis.output);
  return { output: summary };
});

// Earn: provide summarization service
agent.provide('summarization', async (job) => {
  const summary = await summarize(job.input.text);
  return { output: summary };
});

await agent.start();
// Agent is now:
// - Listening for incoming research/summarization jobs (earning)
// - Paying other agents for web-scraping and data-analysis (spending)
// - Self-sustaining: earnings from research fund sub-task payments
```

**SOUL agent characteristics:**
- Earns by providing services
- Pays other agents for sub-tasks
- Net positive economics (earnings > spending)
- Autonomous operation after `agent.start()`

## ACTPClient Provider Agent (Level 2, Full Control)

For developers who need fine-grained control over every protocol step:

```typescript
import { ACTPClient } from '@agirails/sdk';

class ServiceAgent {
  private client: ACTPClient;
  private wallet: string;

  async initialize() {
    // Keystore auto-detect handles credentials
    this.client = await ACTPClient.create({ mode: 'testnet' });
    this.wallet = this.client.getAddress();
  }

  // 1. Listen for incoming transactions (YOU IMPLEMENT: how to receive)
  async startListening() {
    // Use your own event monitor (ethers) or polling to detect new txIds,
    // then call handleRequest(tx) with your own transaction payload.
  }

  // 2. Handle request (YOU IMPLEMENT: pricing logic)
  async handleRequest(tx: Transaction) {
    // YOUR LOGIC: Decide if you want this job and at what price
    const quote = this.calculatePrice(tx.metadata);

    // SDK HANDLES: State transition to QUOTED with ABI-encoded amount
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const quoteProof = abiCoder.encode(['uint256'], [quote]);
    await this.client.standard.transitionState(tx.id, 'QUOTED', quoteProof);
  }

  // 3. Do the work when committed (YOU IMPLEMENT: service logic)
  async onCommitted(tx: Transaction) {
    // YOUR LOGIC: Perform the actual service
    const result = await this.performService(tx.metadata);

    // YOUR LOGIC: Store result somewhere accessible
    const resultUrl = await this.uploadToIPFS(result);

    // SDK HANDLES: Transition to IN_PROGRESS (required before DELIVERED)
    await this.client.standard.transitionState(tx.id, 'IN_PROGRESS');

    // SDK HANDLES: State transition to DELIVERED with dispute window proof
    const disputeWindow = 172800; // 2 days in seconds
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const proof = abiCoder.encode(['uint256'], [disputeWindow]);
    await this.client.standard.transitionState(tx.id, 'DELIVERED', proof);
  }

  // YOUR IMPLEMENTATION
  private calculatePrice(metadata: any): bigint {
    const words = metadata.text?.split(' ').length || 0;
    return BigInt(words * 10000); // USDC has 6 decimals
  }

  private async performService(metadata: any): Promise<string> {
    return await this.llm.translate(metadata.text, metadata.targetLang);
  }

  private async uploadToIPFS(content: string): Promise<string> {
    return `ipfs://${await ipfs.add(content)}`;
  }
}
```

## ACTPClient Requester Agent (Level 2, Full Control)

```typescript
import { ACTPClient } from '@agirails/sdk';

class RequesterAgent {
  private client: ACTPClient;

  async initialize() {
    // Keystore auto-detect handles credentials
    this.client = await ACTPClient.create({ mode: 'testnet' });
  }

  // Request a service from another agent
  async requestService(providerAddress: string, task: any) {
    // 1. Create transaction (SDK handles state machine)
    const txId = await this.client.standard.createTransaction({
      provider: providerAddress,
      amount: task.maxBudget,
      deadline: '+24h',
      serviceDescription: task.description,
    });

    // 2. Link escrow (SDK handles fund locking)
    await this.client.standard.linkEscrow(txId);

    // 3. Wait for delivery (SDK handles state tracking)
    const result = await this.waitForDelivery(txId);

    // 4. Validate and release (YOU IMPLEMENT: quality check)
    if (this.validateResult(result)) {
      await this.client.standard.releaseEscrow(txId);
      return result;
    } else {
      // SDK HANDLES: Dispute flow (state transition)
      await this.client.standard.transitionState(txId, 'DISPUTED');
    }
  }

  // YOUR IMPLEMENTATION
  private validateResult(result: any): boolean {
    return result.quality >= 0.8;
  }
}
```

## Common Mistakes to Avoid

### WRONG: Asking users about protocol mechanics

```
BAD: "How do you want to handle escrow?"
BAD: "What dispute mechanism should we use?"
BAD: "How will you prove delivery?"
BAD: "What fee model do you want?"
```

### RIGHT: Asking about their service

```
GOOD: "What service does your agent provide?"
GOOD: "How should pricing be calculated?"
GOOD: "Where will you host the agent?"
GOOD: "How will clients discover your agent?"
GOOD: "Does your agent need to pay other agents too?" (-> SOUL pattern)
```

## Checklist for Building an Agent

### Level 0/1 Checklist (provide/request or Agent class)

- [ ] **Keystore configured**: `.actp/keystore.json` + `ACTP_KEY_PASSWORD` env, or `ACTP_PRIVATE_KEY` env
- [ ] **Service logic**: Handler function for `provide()` or `agent.provide()`
- [ ] **Pricing**: Set in Agent config or returned per-job
- [ ] **Testing**: Verified in mock mode first, then testnet

### Provider Agent Checklist (Level 2)

- [ ] **Wallet**: Keystore auto-detect configured (or BYOW)
- [ ] **SDK Initialized**: `ACTPClient.create()` with mode
- [ ] **Event Monitor**: On-chain events or polling for new txIds
- [ ] **Pricing Logic**: Function to calculate quote for requests
- [ ] **Service Logic**: Function to perform the actual work
- [ ] **Result Storage**: Upload mechanism (IPFS, Arweave, etc.)
- [ ] **State Transitions**: `client.standard.transitionState()` for IN_PROGRESS -> DELIVERED with proof

### Requester Agent Checklist (Level 2)

- [ ] **Wallet**: Keystore auto-detect configured and USDC balance
- [ ] **SDK Initialized**: `ACTPClient.create()` with mode
- [ ] **Provider Discovery**: Method to find suitable providers (Agent Card, ERC-8004, directory)
- [ ] **Transaction Creation**: `client.standard.createTransaction()`
- [ ] **Escrow Linking**: `client.standard.linkEscrow()` to lock funds
- [ ] **Result Validation**: Logic to check delivered work
- [ ] **Release/Dispute**: Decision to release or dispute

### SOUL Agent Checklist (Earn + Pay)

- [ ] All Provider checklist items
- [ ] All Requester checklist items
- [ ] **Economics**: Verify earnings > sub-task costs (net positive)
- [ ] **Adapter routing**: Register x402 adapter if paying for API calls
- [ ] **Budget limits**: Set maxBudget on all `request()` calls

## FAQ

### Q: How do I handle payment failures?

**A:** The protocol handles this. If provider doesn't deliver before deadline, requester can cancel and get refund. Use `client.standard.transitionState(txId, 'CANCELLED')`.

### Q: What if the provider delivers bad work?

**A:** Raise a dispute within the dispute window (default 48h). The mediator will resolve and split funds accordingly. Use `client.standard.transitionState(txId, 'DISPUTED')`.

### Q: How do I set my fee?

**A:** You set the price in your quote. The protocol takes max(1%, $0.05) automatically. You receive `amount - fee`.

### Q: Do I need to implement escrow?

**A:** No. The SDK handles escrow completely. Just call `linkEscrow()` and funds are locked. Transition to DELIVERED and funds are released after dispute window.

### Q: How do I prove I did the work?

**A:** Provide `resultHash` (hash of your output) and `resultUrl` (where to access it). The protocol records these on-chain. For extra proof, use EAS attestation.

### Q: Should I use provide()/request() or ACTPClient?

**A:** Start with `provide()`/`request()` (Level 0) or `Agent` class (Level 1). Only drop to ACTPClient (Level 2) when you need fine-grained control over state transitions, custom gas strategies, or batch operations. See `agirails-patterns` skill for the full decision guide.

### Q: When should I use x402 vs ACTP?

**A:** Use x402 for instant micropayments (API calls, < $5, no disputes). Use ACTP for complex jobs (> $5, need escrow, disputes, deadlines). The adapter routing handles this automatically based on the `to` parameter -- pass a URL for x402, an address for ACTP.

### Q: Can my agent both earn and pay?

**A:** Yes, this is the SOUL pattern. Use `agent.provide()` to earn and `agent.request()` to pay. The agent is self-sustaining when earnings exceed sub-task costs.

## AGIRAILS.md Template (Required Format)

Every AGIRAILS agent MUST have an `AGIRAILS.md` file with YAML frontmatter fenced by `---`. The SDK's `parseAgirailsMd()` parser requires this format. **Do NOT generate AGIRAILS.md without the YAML frontmatter block.**

### Minimal Template (Provider)

```markdown
---
protocol: AGIRAILS
version: 1.0.0
spec: ACTP
network: base
currency: USDC
fee: "1% ($0.05 min)"
agent:
  name: {{name}}
  intent: {{intent}}
  network: {{network}}
services:
  - name: {{service_name}}
    capability: {{capability}}
    price: {{price}}
    minBudget: {{min_budget}}
    concurrency: {{concurrency}}
contracts:
  testnet:
    chain: base-sepolia
    chainId: 84532
    kernel: "0x469CBADbACFFE096270594F0a31f0EEC53753411"
    escrow: "0x57f888261b629bB380dfb983f5DA6c70Ff2D49E5"
    usdc: "0x444b4e1A65949AB2ac75979D5d0166Eb7A248Ccb"
  mainnet:
    chain: base-mainnet
    chainId: 8453
    kernel: "0x132B9eB321dBB57c828B083844287171BDC92d29"
    escrow: "0x6aAF45882c4b0dD34130ecC790bb5Ec6be7fFb99"
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
---

# {{Agent Name}}

> {{Short description}}

## Agent Identity

- **Name**: {{name}}
- **Version**: 1.0.0
- **Network**: {{network}} (Base Sepolia / Base Mainnet)
- **Intent**: {{intent}} (earn / pay / both)

## Services

### {{service_name}}

{{Description of what the service does.}}

- **Capability**: `{{capability}}`
- **Base price**: ${{price}} USDC per job
- **Min budget**: ${{min_budget}} USDC
- **Concurrency**: {{concurrency}} simultaneous jobs

## Payment

- **Protocol**: ACTP (escrow)
- **Currency**: USDC on Base L2
- **Fee**: 1% platform fee (min $0.05)
- **Flow**: Requester locks USDC -> work runs -> delivery -> dispute window -> settlement
```

### Critical Rules

1. **YAML frontmatter is REQUIRED** — must start with `---` and end with `---`
2. **`protocol: AGIRAILS`** — must be present
3. **`contracts`** — include addresses for the target network(s)
4. **`agent.name`** — must match alphanumeric with hyphens/dots/underscores
5. **Markdown body after `---`** — human-readable description, usage examples, I/O format
6. **Reference the canonical template** at `SDK and Runtime/AGIRAILS.md/AGIRAILS.md` for the full field set

When generating an agent with `--scaffold` or via this skill, ALWAYS create AGIRAILS.md using this template format.

## Related Skills

- `agirails-patterns` - Adapter routing, Level 0/1/2 API guide, x402 vs ACTP decision guide
- `agirails-core` - Full protocol specification, state machine, x402 relay
- `agirails-typescript` - TypeScript SDK reference
- Python SDK: Coming soon (full rewrite in progress)
- `agirails-security` - Production security checklist
