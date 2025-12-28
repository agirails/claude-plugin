# AGIRAILS SDK Plugin

[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-blueviolet.svg)](https://claude.ai/code)
[![Skills](https://img.shields.io/badge/skills-5-blue.svg)]()
[![Commands](https://img.shields.io/badge/commands-8-green.svg)]()
[![Agents](https://img.shields.io/badge/agents-4-orange.svg)]()
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> Zero to first transaction in 15 minutes.

Enable your AI agents to pay each other with blockchain-secured escrow.

## Features

- **5 Skills** - Protocol knowledge loaded into Claude's context
- **8 Commands** - Guided workflows for common tasks
- **4 Agents** - Autonomous helpers for complex integrations
- **TypeScript & Python** - Full support for both languages
- **Mock Mode** - Instant testing without blockchain setup

## Quick Start

```bash
# 1. Install plugin
/plugin install agirails

# 2. Set up SDK in your project
/agirails:init

# 3. Create your first payment
/agirails:pay
```

## Commands

| Command | Description |
|---------|-------------|
| `/agirails:init` | Set up SDK in your project |
| `/agirails:pay` | Create a payment interactively |
| `/agirails:status` | Check transaction status |
| `/agirails:watch` | Monitor transaction in real-time |
| `/agirails:debug` | Diagnose integration issues |
| `/agirails:states` | Visualize ACTP state machine |
| `/agirails:upgrade` | Upgrade SDK version |
| `/agirails:example` | Generate working code examples |

## Skills

Skills are automatically loaded when you discuss related topics:

- **agirails-core** - ACTP protocol, state machine, invariants
- **agirails-patterns** - Three-tier API, mode selection
- **agirails-security** - Production checklist, key management
- **agirails-typescript** - TypeScript SDK reference
- **agirails-python** - Python SDK reference

## Agents

Agents handle complex, multi-step tasks:

- **integration-wizard** - Full integration walkthrough
- **testing-assistant** - Generate comprehensive tests
- **migration-helper** - SDK version upgrades
- **security-auditor** - Proactive security review

## Requirements

- Claude Code CLI
- Node.js 18+ (for TypeScript) or Python 3.9+ (for Python)
- No blockchain wallet needed for mock mode

## Mock Mode

All examples use mock mode by default:
- No real funds or blockchain required
- State persists in `.actp/` directory
- Mint unlimited test USDC
- Perfect for development and testing

## Learn More

- [AGIRAILS Documentation](https://docs.agirails.io)
- [ACTP Protocol Specification](https://docs.agirails.io/protocol)
- [SDK Reference](https://docs.agirails.io/sdk)
- [GitHub Repository](https://github.com/agirails/claude-plugin)

## Support

- **Discord**: [AGIRAILS Community](https://discord.gg/nuhCt75qe4)
- **Email**: developers@agirails.io
- **Issues**: [GitHub Issues](https://github.com/agirails/claude-plugin/issues)

## License

Apache-2.0
