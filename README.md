# AGIRAILS Plugin for Claude Code

[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-blueviolet.svg)](https://claude.ai/code)
[![Skills](https://img.shields.io/badge/skills-6-blue.svg)]()
[![Commands](https://img.shields.io/badge/commands-8-green.svg)]()
[![Agents](https://img.shields.io/badge/agents-4-orange.svg)]()
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**Give your AI agent a wallet. Let it earn and pay USDC — settled on-chain, gasless, in under 2 seconds.**

AGIRAILS is the open settlement layer for AI agents on Base L2. This plugin turns Claude Code into a full AGIRAILS integration environment — interactive onboarding, guided payments, autonomous security audits, and protocol knowledge loaded into every conversation.

## Why This Exists

AI agents need to pay each other. Not with API keys and invoices — with real money, real escrow, real dispute resolution. AGIRAILS handles the hard parts:

| What you get | How it works |
|---|---|
| **Gasless transactions** | Gas sponsored — your agent never needs ETH |
| **USDC settlement** | Real stablecoin, not tokens. $1 = $1. On Base L2. |
| **Encrypted wallet** | Auto-generated keystore (AES-128-CTR, chmod 600, gitignored). No keys in code, ever. |
| **Two payment modes** | ACTP escrow for complex jobs. x402 instant for API calls. Same SDK. |
| **On-chain identity** | ERC-8004 portable identity + reputation. Follows your agent across marketplaces. |
| **10,000 test USDC** | `actp init` in mock mode — start building immediately. Testnet: 1,000 USDC minted gaslessly during registration. |
| **1% transparent fee** | `max(amount * 1%, $0.05)`. Same on both payment paths. No subscriptions. |

## ACTP or x402? Pick the Right Payment Mode

```
Need time to do the work?  →  ACTP (escrow)
  Lock USDC → work → deliver → dispute window → settle
  Think: hiring a contractor

Instant API call?  →  x402 (instant)
  Pay → get response. One step. No escrow. No disputes.
  Think: buying from a vending machine
```

Both modes are in the same SDK. Your agent can use both simultaneously.

## Quick Start

```bash
# 1. Install plugin
/plugin install agirails

# 2. Set up SDK in your project
/agirails:init

# 3. Create your first payment
/agirails:pay
```

Or skip the plugin and use the SDK directly:

```bash
npx actp init --mode mock
npx actp init --scaffold --intent earn --service code-review --price 5
npx ts-node agent.ts
```

Three commands. Mock mode. No keys, no gas, no config.

## Commands

| Command | What it does |
|---------|-------------|
| `/agirails:init` | Interactive setup — asks preferences, installs SDK, generates agent code |
| `/agirails:pay` | Guided payment — routes ACTP or x402 based on recipient format |
| `/agirails:status` | Check transaction state in the 8-state machine |
| `/agirails:watch` | Monitor transaction state changes in real-time |
| `/agirails:debug` | Diagnose integration issues with automatic fix suggestions |
| `/agirails:states` | Visualize the ACTP state machine with transition rules |
| `/agirails:upgrade` | Upgrade SDK version with migration guidance |
| `/agirails:example` | Generate working code examples adapted to your project |

## Skills

Skills load automatically when you discuss related topics:

| Skill | Triggers on |
|-------|-------------|
| **agirails-core** | Protocol, state machine, escrow, contracts, fees |
| **agirails-typescript** | TypeScript SDK, `@agirails/sdk`, Node.js integration |
| **agirails-python** | Python SDK, `agirails` package, asyncio patterns |
| **agirails-patterns** | API tiers (Level 0/1/2), adapter routing, mode selection |
| **agirails-agent-building** | Provider/requester setup, SOUL pattern, pricing model |
| **agirails-security** | Key management, production checklist, security audit |

## Agents

Agents handle complex, multi-step tasks autonomously:

| Agent | What it does |
|-------|-------------|
| **integration-wizard** | End-to-end walkthrough based on your tech stack |
| **testing-assistant** | Generate tests covering happy paths, edge cases, and error scenarios |
| **security-auditor** | Proactive review for key management, escrow safety, production readiness |
| **migration-helper** | SDK version upgrades with breaking change guidance |

## Networks

| | Mock | Testnet (Base Sepolia) | Mainnet (Base) |
|---|---|---|---|
| **Cost to start** | Free | Free (1,000 USDC minted during registration) | Real USDC |
| **Gas** | Simulated | Gas sponsored | Gas sponsored |
| **USDC** | 10,000 auto-minted | 1,000 minted gaslessly on registration | bridge.base.org |
| **Escrow** | Auto-releases | Manual `release()` | Manual `release()` |
| **Tx limit** | None | None | $1,000 |

## Requirements

- Claude Code CLI
- Node.js 18+ (TypeScript) or Python 3.9+ (Python)
- No wallet or blockchain needed for mock mode

## Links

- [SDK (npm)](https://www.npmjs.com/package/@agirails/sdk) | [SDK (pip)](https://pypi.org/project/agirails/)
- [GitHub](https://github.com/agirails) | [Docs](https://docs.agirails.io) | [Examples](https://github.com/agirails/sdk-js/tree/main/examples)
- [Discord](https://discord.gg/nuhCt75qe4) | [Issues](https://github.com/agirails/claude-plugin/issues)
- Security: security@agirails.io

## License

Apache-2.0
