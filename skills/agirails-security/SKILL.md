---
description: This skill provides security guidance for AGIRAILS integrations when the user discusses production deployment, security review, private keys, key management, production checklist, or asks about security best practices. Use this skill when reviewing code for security issues or preparing for production deployment.
---

# AGIRAILS Security Guide

Security is critical when handling payments. Follow these guidelines to protect user funds and maintain trust.

## Key Resolution Order

The SDK resolves signing keys in this priority:

```
1. ACTP_PRIVATE_KEY env var (explicit key, for CI/testing)
2. .actp/keystore.json + ACTP_KEY_PASSWORD (encrypted at rest, recommended)
3. wallet: 'auto' (Smart Wallet + micro-airdrop gas, zero-config)
```

The address is always derived from the key automatically -- never specify `requesterAddress` manually.

## Critical Security Rules

### 1. Never Hardcode Private Keys

```typescript
// WRONG - Private key exposed in code
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey: '0x1234567890abcdef...', // CRITICAL BUG
});

// CORRECT - SDK auto-detects from keystore
const client = await ACTPClient.create({ mode: 'mainnet' });
// Key loaded from .actp/keystore.json + ACTP_KEY_PASSWORD env var
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
# AGIRAILS
.actp/
.env
.env.local
.env.*.local
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

## Key Management

### Development (Mock Mode)

No key needed -- mock mode generates ephemeral keys:

```typescript
const client = await ACTPClient.create({ mode: 'mock' });
```

### Testing (Testnet)

Use an encrypted keystore (recommended):

```bash
# Generate encrypted keystore
actp init
# Enter password when prompted → creates .actp/keystore.json

# Set password in env
export ACTP_KEY_PASSWORD=your-password

# SDK auto-detects keystore
const client = await ACTPClient.create({ mode: 'testnet' });
```

### Production (Mainnet)

**Option 1: Keystore (recommended for most)**
```
.actp/keystore.json + ACTP_KEY_PASSWORD from secrets manager
```

**Option 2: Explicit key from vault**
```bash
ACTP_PRIVATE_KEY=$(vault read -field=key secret/agirails)
```

**Option 3: Smart Wallet (zero-config, Tier 1)**
```typescript
ACTPClient.create({ mode: 'mainnet', wallet: 'auto' })
```

For detailed key management patterns, see `references/key-management.md`.

## x402 Security Considerations

x402 is a protocol for instant HTTP-based payments. Extra caution is required:

- **x402 payments are instant and non-refundable** -- there is no escrow or dispute mechanism
- **Always validate x402 provider URLs** -- HTTPS only, never HTTP
- **X402Relay enforces fee splitting atomically** -- fees cannot be skipped or manipulated
- **Set reasonable spending limits for x402 auto-payments** -- a misconfigured agent can drain funds fast
- **Verify the x402 endpoint before paying** -- confirm the service is legitimate and returns expected data
- **Monitor x402 spend separately** -- since there is no refund path, track cumulative spend carefully

## Production Checklist

Before going to mainnet, complete this checklist:

### Code Security
- [ ] No hardcoded private keys
- [ ] No keys in logs or error messages
- [ ] Input validation on all user data
- [ ] Error handling doesn't leak sensitive info
- [ ] Dependencies audited (npm audit / pip audit)

### Configuration
- [ ] Keystore encrypted with strong password (or ACTP_PRIVATE_KEY from vault)
- [ ] ACTP_KEY_PASSWORD injected from secrets manager, not committed
- [ ] .gitignore includes .env and .actp/
- [ ] Mode set via environment (not hardcoded)
- [ ] RPC URL is private/authenticated

### Testing
- [ ] All tests pass on testnet
- [ ] Edge cases tested (deadline, disputes)
- [ ] Error scenarios handled gracefully
- [ ] Load testing completed
- [ ] x402 payment flows tested separately

### Monitoring
- [ ] Transaction monitoring set up
- [ ] Balance alerts configured
- [ ] Error tracking (Sentry, etc.)
- [ ] Uptime monitoring
- [ ] x402 spend tracking enabled

### Operations
- [ ] Incident response plan documented
- [ ] Key rotation procedure defined
- [ ] Backup RPC endpoints configured
- [ ] Admin procedures documented

For the complete 20-point checklist, see `references/production-checklist.md`.

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
- Configuring x402 adapters or relay endpoints

**Checks performed:**
- Hardcoded keys detection
- Log statement analysis
- .gitignore verification
- Input validation review
- Mode selection check
- x402 URL validation (HTTPS enforcement)
- Keystore password exposure check

## Incident Response

If you suspect a security issue:

1. **Pause Operations**
   ```typescript
   // Stop creating new transactions
   process.env.AGIRAILS_PAUSED = 'true';
   ```

2. **Rotate Compromised Keys**
   - Generate new keystore: `actp init` (creates new .actp/keystore.json)
   - Transfer remaining funds to new address
   - Update ACTP_KEY_PASSWORD in secrets manager
   - Redeploy configuration

3. **Investigate**
   - Check transaction logs
   - Review access logs
   - Identify attack vector
   - Check x402 payment history for unauthorized spend

4. **Report**
   - Contact AGIRAILS security: https://agirails.io/contact
   - Document incident
   - Prepare disclosure if needed

## Related Resources

- Full production checklist: `references/production-checklist.md`
- Key management patterns: `references/key-management.md`
- AGIRAILS security contact: https://agirails.io/contact
