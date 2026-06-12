---
description: Set up AGIRAILS agent payments by fetching the canonical protocol file and following its onboarding. This is the single source of truth — it stays current automatically.
allowed-tools:
  - WebFetch
  - Glob
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
argument-hint: ""
---

# /agirails:init

Set up AGIRAILS agent payments in the current project.

> **This command does NOT reimplement onboarding.** The canonical, always-current
> onboarding flow lives in the protocol file at
> `https://www.agirails.app/protocol/AGIRAILS.md`. This command's only job is to
> fetch that file and follow it exactly. Anything you reimplement here will drift
> out of date the moment the protocol moves — so don't.

## Do this, in order

### 1. Fetch the canonical protocol file

```bash
curl -sLO https://www.agirails.app/protocol/AGIRAILS.md
```

(Or `WebFetch` the same URL.) This file is ~50 KB of YAML + Markdown. It is the
authoritative spec AND the onboarding script — it contains an `onboarding:` block
with the exact questions to ask, the order to ask them in, and the commands to run.

### 2. Read it and follow its `onboarding` section literally

Read the file you just downloaded. Find the `onboarding:` block in the YAML
frontmatter. It defines:

- the **questions** to ask the user (name, intent, services, price, budget, …),
  including which are conditional on `intent` (a pay-only buyer is not asked for a
  selling price; an earn-only provider is not asked what it wants to buy);
- the **defaults** to apply WITHOUT asking (network → testnet, wallet → generate);
- the **setup steps** to run.

Ask the questions with `AskUserQuestion`. Apply the no-ask defaults silently. Then
run the setup the file describes. As of this writing the happy path is a single
command:

```bash
npx @agirails/sdk@latest init --mode testnet --intent <pay|earn|both> --test
```

— which generates an encrypted keystore, auto-mints 1,000 test USDC (gasless),
links/publishes the agent, then drives a real on-chain transaction against the
network's default counterparty (Sentinel) all the way to **SETTLED**, ending with a
public receipt URL and a framed receipt. **But do not hard-code that command from
this doc** — read the version in the freshly-downloaded AGIRAILS.md and run what IT
says, because the flags and steps evolve.

### 3. Confirm the wow moment

The flow is correct when the user sees the full lifecycle
(`INITIATED → COMMITTED → IN_PROGRESS → DELIVERED → SETTLED`) and a
`https://agirails.app/r/<id>` receipt URL — on **testnet**, on-chain, not mock.

## What NOT to do

- **Do NOT default to mock mode.** The onboarding wow flow is testnet-first. Mock is
  for later local development, not first-run setup.
- **Do NOT hand-write `client.ts` / `pay.ts` scaffolding** or reverse-engineer the
  escrow lifecycle. `actp test` (driven by AGIRAILS.md) already settles a real
  transaction end-to-end. Hand-rolling it lands the user in mock mode with a
  half-working manual flow — exactly the failure this command exists to prevent.
- **Do NOT invent AGIRAILS.md frontmatter** from memory. The canonical V4 schema
  lives in the downloaded file and on the web onboarding; generate identity files
  via `actp init` / `actp publish`, which stamp the correct hashes.
- **Do NOT skip the questions.** A fresh user expects to be asked their agent's name
  and intent. Silently scaffolding a project is the wrong experience.

## After setup

Point the user at the other plugin commands, which ARE safe thin helpers:

- `/agirails:pay` — create a payment
- `/agirails:status` — check a transaction
- `/agirails:watch` — watch a transaction live
- `/agirails:states` — explain the 8-state machine
- `/agirails:debug` — diagnose a stuck transaction

## Why it's built this way

There used to be two onboarding surfaces — this command and the protocol file — and
they drifted. A locally-cached copy of this command went stale (old non-V4
frontmatter, mock-mode defaults, a dead `client.mock.mint()` API) and hijacked
fresh "set up payments" prompts, pulling users into a manual mock scaffold instead of
the on-chain wow flow. Collapsing onboarding to a single server-hosted source
(AGIRAILS.md) makes that class of drift impossible.
