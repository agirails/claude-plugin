# Key Management Patterns

## Overview

Private key security is critical for blockchain applications. Choose the right pattern for your environment.

## By Environment

### Development (Mock Mode)

No real key needed. Use a placeholder address.

```typescript
const client = await ACTPClient.create({
  mode: 'mock',
  requesterAddress: '0x1234567890123456789012345678901234567890',
});
```

### Testing (Testnet)

Generate a dedicated test wallet. Never use for real funds.

```bash
# Generate new wallet
npx ethers-cli wallet random

# Output:
# Address: 0xAbc...
# Private Key: 0x123...

# Store in .env
echo "PRIVATE_KEY=0x123..." >> .env.test
```

```typescript
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.PRIVATE_KEY,
});
```

### Production (Mainnet)

Multiple options, ordered by security level:

---

## Option 1: Environment Variables (Basic)

**Security Level:** ⭐⭐ (Moderate)

**Best For:** Simple deployments, Docker containers

```bash
# Set in environment
export PRIVATE_KEY=0x...
```

```typescript
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey: process.env.PRIVATE_KEY,
});
```

**Pros:**
- Simple
- Works everywhere
- No external dependencies

**Cons:**
- Key in memory
- Process inspection risk
- No audit trail

---

## Option 2: Secrets Manager (Recommended)

**Security Level:** ⭐⭐⭐⭐ (High)

**Best For:** Cloud deployments, production services

### AWS Secrets Manager

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getPrivateKey(): Promise<string> {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const command = new GetSecretValueCommand({
    SecretId: 'agirails/wallet/production',
  });
  const response = await client.send(command);
  const secret = JSON.parse(response.SecretString!);
  return secret.privateKey;
}

const privateKey = await getPrivateKey();
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey,
});
```

### HashiCorp Vault

```typescript
import Vault from 'node-vault';

async function getPrivateKey(): Promise<string> {
  const vault = Vault({
    apiVersion: 'v1',
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  });

  const result = await vault.read('secret/data/agirails/wallet');
  return result.data.data.privateKey;
}
```

### Google Secret Manager

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

async function getPrivateKey(): Promise<string> {
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: 'projects/my-project/secrets/agirails-pk/versions/latest',
  });
  return version.payload!.data!.toString();
}
```

**Pros:**
- Centralized management
- Access control
- Audit logging
- Automatic rotation support

**Cons:**
- External dependency
- Additional cost
- Network latency

---

## Option 3: Hardware Wallet (Maximum Security)

**Security Level:** ⭐⭐⭐⭐⭐ (Maximum)

**Best For:** High-value operations, custody solutions

### Ledger

```typescript
import { LedgerSigner } from '@ethersproject/hardware-wallets';

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new LedgerSigner(provider, 'hid', "m/44'/60'/0'/0/0");

// Use signer directly (key never leaves device)
const address = await signer.getAddress();
```

### Trezor

```typescript
import TrezorConnect from 'trezor-connect';

TrezorConnect.init({
  manifest: {
    email: 'your@email.com',
    appUrl: 'https://your-app.com',
  },
});

async function signTransaction(tx: any) {
  const result = await TrezorConnect.ethereumSignTransaction({
    path: "m/44'/60'/0'/0/0",
    transaction: tx,
  });
  return result.payload.serializedTx;
}
```

**Pros:**
- Key never exposed
- Physical confirmation
- Tamper-resistant

**Cons:**
- Requires physical device
- Manual confirmation (not for automation)
- Limited to specific operations

---

## Option 4: MPC (Multi-Party Computation)

**Security Level:** ⭐⭐⭐⭐⭐ (Maximum + Distributed)

**Best For:** Enterprise, custody, high-value automated operations

### Fireblocks

```typescript
import { FireblocksSDK } from 'fireblocks-sdk';

const fireblocks = new FireblocksSDK(
  process.env.FIREBLOCKS_SECRET,
  process.env.FIREBLOCKS_API_KEY
);

async function signTransaction(tx: any) {
  const result = await fireblocks.createTransaction({
    assetId: 'BASE_USDC',
    operation: 'CONTRACT_CALL',
    source: { type: 'VAULT_ACCOUNT', id: '0' },
    destination: { type: 'ONE_TIME_ADDRESS', oneTimeAddress: { address: tx.to } },
    extraParameters: { contractCallData: tx.data },
  });
  return result;
}
```

**Pros:**
- Key never exists in one place
- Requires multiple parties to sign
- Enterprise-grade security
- Full audit trail

**Cons:**
- Complex setup
- Expensive
- Vendor lock-in

---

## Key Rotation

### Procedure

1. **Generate new wallet**
   ```bash
   npx ethers-cli wallet random
   ```

2. **Transfer funds**
   ```typescript
   // Transfer USDC to new address
   await usdc.transfer(newAddress, await usdc.balanceOf(oldAddress));

   // Transfer ETH for gas
   await oldSigner.sendTransaction({
     to: newAddress,
     value: await provider.getBalance(oldAddress) - gasReserve,
   });
   ```

3. **Update configuration**
   - Update secrets manager
   - Deploy new configuration
   - Verify new wallet works

4. **Decommission old key**
   - Remove from secrets manager
   - Add to revocation list
   - Document rotation

### Rotation Schedule

| Risk Level | Rotation Frequency |
|------------|-------------------|
| Low (testnet) | Never (disposable) |
| Medium (automated) | Quarterly |
| High (custody) | Monthly |
| Compromised | Immediately |

---

## Anti-Patterns

### Never Do This

```typescript
// WRONG: Hardcoded key
const privateKey = '0x1234...';

// WRONG: Key in code comment
// Private key: 0x1234... (for testing)

// WRONG: Key in config file
import config from './config.json';
const privateKey = config.privateKey;

// WRONG: Key logged
console.log('Using key:', privateKey);

// WRONG: Key in error message
throw new Error(`Failed with key ${privateKey}`);
```

### Always Do This

```typescript
// CORRECT: Environment variable
const privateKey = process.env.PRIVATE_KEY;

// CORRECT: Secrets manager
const privateKey = await secretsManager.getSecret('pk');

// CORRECT: Validation without exposure
if (!privateKey || !privateKey.startsWith('0x')) {
  throw new Error('Invalid private key configuration');
}

// CORRECT: Masked logging
logger.info('Wallet initialized', {
  address: wallet.address,
  // Never log privateKey
});
```

---

## Emergency Procedures

### Key Compromise Response

1. **Immediate** (within minutes)
   - Stop all automated operations
   - Rotate to backup key
   - Transfer funds to secure wallet

2. **Short-term** (within hours)
   - Investigate breach source
   - Revoke compromised key access
   - Notify affected parties

3. **Long-term** (within days)
   - Complete security audit
   - Implement additional controls
   - Document incident
