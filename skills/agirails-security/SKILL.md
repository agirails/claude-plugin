---
description: This skill provides security guidance for AGIRAILS integrations when the user discusses production deployment, security review, private keys, key management, production checklist, or asks about security best practices. Use this skill when reviewing code for security issues or preparing for production deployment.
---

# AGIRAILS Security Guide

Security is critical when handling payments. Follow these guidelines to protect user funds and maintain trust.

## Critical Security Rules

### 1. Never Hardcode Private Keys

```typescript
// WRONG - Private key exposed in code
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey: '0x1234567890abcdef...', // CRITICAL BUG
  requesterAddress: '0xYourAddress',
});

// CORRECT - Use environment variables
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey: process.env.PRIVATE_KEY,
  requesterAddress: process.env.REQUESTER_ADDRESS,
});
```

### 2. Never Log Sensitive Data

```typescript
// WRONG - Key could appear in logs
console.log('Initializing with key:', privateKey);
logger.debug({ privateKey, address });

// CORRECT - Never log keys
console.log('Initializing wallet:', address);
logger.debug({ address, mode });
```

### 3. Always Use .gitignore

```gitignore
# Required entries
.env
.env.local
.env.production
.actp/
*.pem
*.key
```

### 4. Validate All Inputs

```typescript
// WRONG - No validation
async function pay(to: string, amount: string) {
  return client.basic.pay({ to, amount });
}

// CORRECT - Validate inputs
async function pay(to: string, amount: string) {
  if (!isValidAddress(to)) {
    throw new Error('Invalid address');
  }
  if (!isValidAmount(amount)) {
    throw new Error('Invalid amount');
  }
  if (to.toLowerCase() === myAddress.toLowerCase()) {
    throw new Error('Cannot pay yourself');
  }
  return client.basic.pay({ to, amount });
}
```

## Production Checklist

Before going to mainnet, complete this checklist:

### Code Security
- [ ] No hardcoded private keys
- [ ] No keys in logs or error messages
- [ ] Input validation on all user data
- [ ] Error handling doesn't leak sensitive info
- [ ] Dependencies audited (npm audit / pip audit)

### Configuration
- [ ] Environment variables for all secrets
- [ ] .gitignore includes .env and .actp/
- [ ] Mode set via environment (not hardcoded)
- [ ] RPC URL is private/authenticated

### Testing
- [ ] All tests pass on testnet
- [ ] Edge cases tested (deadline, disputes)
- [ ] Error scenarios handled gracefully
- [ ] Load testing completed

### Monitoring
- [ ] Transaction monitoring set up
- [ ] Balance alerts configured
- [ ] Error tracking (Sentry, etc.)
- [ ] Uptime monitoring

### Operations
- [ ] Incident response plan documented
- [ ] Key rotation procedure defined
- [ ] Backup RPC endpoints configured
- [ ] Admin procedures documented

For the complete 20-point checklist, see `references/production-checklist.md`.

## Key Management

### Development (Mock Mode)

```bash
# No real key needed
AGIRAILS_MODE=mock
```

### Testing (Testnet)

```bash
# Generate dedicated test wallet
npx ethers-cli wallet random

# Store in .env (NEVER reuse for mainnet)
PRIVATE_KEY=0x...
```

### Production (Mainnet)

**Option 1: Environment Variables**
```bash
# Set in secure environment
export PRIVATE_KEY=$(vault read -field=key secret/agirails)
```

**Option 2: AWS Secrets Manager**
```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

async function getPrivateKey() {
  const client = new SecretsManager({ region: 'us-east-1' });
  const secret = await client.getSecretValue({ SecretId: 'agirails/pk' });
  return JSON.parse(secret.SecretString).privateKey;
}
```

**Option 3: Hardware Wallet (Highest Security)**
```typescript
import { LedgerSigner } from '@ethersproject/hardware-wallets';

const signer = new LedgerSigner(provider, 'hid', "m/44'/60'/0'/0/0");
```

For detailed key management patterns, see `references/key-management.md`.

## Common Vulnerabilities

### 1. Front-Running

**Risk:** Attacker sees your transaction in mempool and acts first.

**Mitigation:**
- Use private mempools (Flashbots)
- Set reasonable deadlines
- For ACTP: Provider is specified, cannot be front-run

### 2. Replay Attacks

**Risk:** Valid transaction replayed on different chain.

**Mitigation:**
- ACTP uses chain ID in signatures
- SDK handles automatically

### 3. Phishing Addresses

**Risk:** User tricked into sending to wrong address.

**Mitigation:**
```typescript
// Verify addresses before use
function verifyAddress(input: string, expected: string) {
  if (input.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('Address mismatch');
  }
}
```

### 4. Insufficient Balance Checks

**Risk:** Transaction fails, user confused.

**Mitigation:**
```typescript
// Check balance before transaction
import { ethers } from 'ethers';

const balanceWei = await client.getBalance(client.getAddress());
const neededWei = (ethers.parseUnits(amount, 6) * 101n) / 100n; // +1% buffer
if (BigInt(balanceWei) < neededWei) {
  throw new Error(`Insufficient balance: ${balanceWei} < ${neededWei}`);
}
```

## Security-Auditor Agent

The plugin includes a security-auditor agent that proactively reviews code for issues.

**Triggers automatically when:**
- Writing code with `privateKey`
- Creating `ACTPClient.create` calls
- Modifying `.env` files
- Asking about production deployment

**Checks performed:**
- Hardcoded keys detection
- Log statement analysis
- .gitignore verification
- Input validation review
- Mode selection check

## Incident Response

If you suspect a security issue:

1. **Pause Operations**
   ```typescript
   // Stop creating new transactions
   process.env.AGIRAILS_PAUSED = 'true';
   ```

2. **Rotate Compromised Keys**
   - Generate new wallet
   - Transfer remaining funds
   - Update configuration

3. **Investigate**
   - Check transaction logs
   - Review access logs
   - Identify attack vector

4. **Report**
   - Contact AGIRAILS security: https://agirails.io/contact
   - Document incident
   - Prepare disclosure if needed

## Related Resources

- Full production checklist: `references/production-checklist.md`
- Key management patterns: `references/key-management.md`
- AGIRAILS security contact: https://agirails.io/contact
