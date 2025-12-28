# Mode Selection Guide

## Mode Overview

| Aspect | Mock | Testnet | Mainnet |
|--------|------|---------|---------|
| **Blockchain** | None | Base Sepolia | Base |
| **Funds** | Unlimited fake | Test tokens | Real USDC |
| **Gas costs** | None | Test ETH | Real ETH |
| **Speed** | Instant | ~2 seconds | ~2 seconds |
| **Persistence** | Local `.actp/` | On-chain | On-chain |
| **Use case** | Development | Pre-prod | Production |

## Mock Mode

### Configuration

```typescript
const client = await ACTPClient.create({
  mode: 'mock',
  requesterAddress: '0x1234567890123456789012345678901234567890',
  stateDirectory: '.actp', // Optional, default
});
```

```python
client = await ACTPClient.create(
    mode="mock",
    requester_address="0x1234567890123456789012345678901234567890",
    state_directory=".actp",  # Optional
)
```

### Features

**Unlimited Test Funds:**
```typescript
// Mint any amount
await client.mock.mint('0x...', 1000000); // 1M USDC
```

**Time Manipulation:**
```typescript
// Fast-forward time (for testing deadlines)
await client.mock.advanceTime(3600); // 1 hour
await client.mock.advanceTime(86400); // 1 day

// Set specific time
await client.mock.setTime(1735689600); // Specific timestamp
```

**State Reset:**
```typescript
// Clear all mock state
await client.mock.reset();

// Clear specific transaction
await client.mock.clearTransaction('0x...');
```

**State Persistence:**
- State saved to `.actp/mock-state.json`
- Persists across process restarts
- Add `.actp/` to `.gitignore`

### Best For

- Local development
- Unit tests
- CI/CD pipelines
- Demos without blockchain
- Rapid prototyping

### Limitations

- Not real blockchain
- No actual token transfers
- No gas mechanics
- Only your process sees state

---

## Testnet Mode

### Configuration

```typescript
const client = await ACTPClient.create({
  mode: 'testnet',
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: 'https://sepolia.base.org', // Optional, has default
});
```

```python
client = await ACTPClient.create(
    mode="testnet",
    private_key=os.environ["PRIVATE_KEY"],
    rpc_url="https://sepolia.base.org",  # Optional
)
```

### Requirements

**1. Test ETH for Gas**

Get from Base Sepolia faucet:
- https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- https://faucet.quicknode.com/base/sepolia

**2. Test USDC**

Options:
- Use mock USDC contract deployed for testing
- Bridge from Sepolia using testnet bridge

**3. Wallet Setup**

```bash
# Generate new wallet for testing (never use for mainnet)
npx ethers-cli wallet random

# Store in .env
PRIVATE_KEY=0x...
```

### Contract Addresses (Base Sepolia)

```typescript
const addresses = {
  kernel: '0x...', // ACTPKernel
  escrow: '0x...', // EscrowVault
  usdc: '0x...',   // Mock USDC
};
```

### Best For

- Integration testing
- Multi-party testing
- Testing real blockchain behavior
- Pre-production verification
- Load testing

### Limitations

- Requires test tokens
- Network latency
- Testnet can be unstable
- Not representative of mainnet gas costs

---

## Mainnet Mode

### Configuration

```typescript
const client = await ACTPClient.create({
  mode: 'mainnet',
  privateKey: process.env.PRIVATE_KEY,
  rpcUrl: process.env.BASE_RPC_URL, // Use private RPC
});
```

```python
client = await ACTPClient.create(
    mode="mainnet",
    private_key=os.environ["PRIVATE_KEY"],
    rpc_url=os.environ["BASE_RPC_URL"],
)
```

### Requirements

**1. Real ETH for Gas**

- Bridge from Ethereum mainnet
- Buy on Coinbase and transfer to Base
- Typical transaction: 0.0001-0.001 ETH

**2. Real USDC**

- USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Bridge from Ethereum or other chains
- Buy directly on Base DEX

**3. Secure Key Management**

NEVER:
- Hardcode private keys
- Log private keys
- Store in git

DO:
- Use environment variables
- Use hardware wallets for significant funds
- Implement key rotation

### Contract Addresses (Base Mainnet)

```typescript
const addresses = {
  kernel: '0x...', // ACTPKernel
  escrow: '0x...', // EscrowVault
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};
```

### Pre-Mainnet Checklist

- [ ] All tests pass on testnet
- [ ] Security review completed
- [ ] Error handling covers all cases
- [ ] Monitoring and alerting set up
- [ ] Incident response plan documented
- [ ] Key management reviewed
- [ ] Rate limiting implemented
- [ ] Backup RPC endpoints configured

### Best For

- Production
- Real money transactions
- Live services

### Considerations

- Real money at stake
- Cannot undo transactions
- Gas costs matter
- Regulatory compliance required

---

## Mode Switching

### Development Workflow

```
1. Local development: mock mode
   ↓ (feature complete)
2. Integration testing: testnet mode
   ↓ (all tests pass)
3. Staging: testnet mode with production-like load
   ↓ (verified)
4. Production: mainnet mode
```

### Environment-Based Configuration

```typescript
const mode = process.env.AGIRAILS_MODE || 'mock';

const client = await ACTPClient.create({
  mode,
  privateKey: mode !== 'mock' ? process.env.PRIVATE_KEY : undefined,
  requesterAddress: mode === 'mock' ? '0x...' : undefined,
});
```

```bash
# .env.development
AGIRAILS_MODE=mock

# .env.staging
AGIRAILS_MODE=testnet
PRIVATE_KEY=0x...

# .env.production
AGIRAILS_MODE=mainnet
PRIVATE_KEY=0x...
BASE_RPC_URL=https://...
```

### Feature Flags

```typescript
const config = {
  mock: {
    autoMint: true,
    skipConfirmations: true,
    allowTimeManipulation: true,
  },
  testnet: {
    autoMint: false,
    skipConfirmations: false,
    allowTimeManipulation: false,
  },
  mainnet: {
    autoMint: false,
    skipConfirmations: false,
    allowTimeManipulation: false,
    requireExplicitConfirmation: true,
  },
};
```

---

## Troubleshooting by Mode

### Mock Mode Issues

**State not persisting:**
```bash
# Check .actp directory exists
ls -la .actp/

# Check permissions
chmod 755 .actp/
```

**Transactions not found:**
```typescript
// State might have been reset
await client.mock.reset();
// Recreate transactions
```

### Testnet Mode Issues

**"Insufficient funds for gas":**
```bash
# Get test ETH from faucet
# Check balance
cast balance $ADDRESS --rpc-url https://sepolia.base.org
```

**"Transaction underpriced":**
```typescript
// Increase gas price
const tx = await kernel.createTransaction(..., {
  maxFeePerGas: parseGwei('1'),
});
```

### Mainnet Mode Issues

**"Insufficient allowance":**
```typescript
// Approve USDC spending first
await client.standard.approveUSDC(amount);
```

**"Nonce too low":**
```typescript
// Get current nonce
const nonce = await provider.getTransactionCount(address);
// Use explicit nonce
const tx = await kernel.createTransaction(..., { nonce });
```
