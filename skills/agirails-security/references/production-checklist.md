# Production Deployment Checklist

Complete all items before deploying to mainnet.

## 1. Code Security (5 items)

### 1.1 No Hardcoded Secrets
- [ ] Grep codebase for `privateKey`, `PRIVATE_KEY`, `0x` patterns
- [ ] Verify no API keys or tokens in source
- [ ] Check no secrets in comments

```bash
# Search for potential secrets
grep -r "privateKey" --include="*.ts" --include="*.js" .
grep -r "0x[a-fA-F0-9]{64}" --include="*.ts" --include="*.js" .
```

### 1.2 Secure Logging
- [ ] No sensitive data in logs
- [ ] Error messages don't expose internals
- [ ] Stack traces filtered in production

```typescript
// Configure logger
const logger = winston.createLogger({
  format: process.env.NODE_ENV === 'production'
    ? winston.format.simple()
    : winston.format.json(),
});
```

### 1.3 Input Validation
- [ ] All addresses validated with checksum
- [ ] Amounts validated (positive, not dust)
- [ ] Deadlines validated (in future)

### 1.4 Dependency Audit
- [ ] Run `npm audit` or `pip audit`
- [ ] Fix high/critical vulnerabilities
- [ ] Lock dependency versions

```bash
npm audit --production
npm audit fix
```

### 1.5 Code Review
- [ ] Security-focused code review completed
- [ ] No TODO/FIXME in security-critical paths
- [ ] Error handling comprehensive

---

## 2. Configuration (5 items)

### 2.1 Environment Variables
- [ ] All secrets in environment variables
- [ ] No default values for secrets
- [ ] Different values per environment

```typescript
// Required env vars
const required = ['PRIVATE_KEY', 'RPC_URL', 'AGIRAILS_MODE'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}`);
  }
}
```

### 2.2 Git Ignore
- [ ] `.env` files ignored
- [ ] `.actp/` directory ignored
- [ ] Build artifacts ignored
- [ ] Verify with `git status`

### 2.3 Mode Configuration
- [ ] Mode set via environment variable
- [ ] Not hardcoded to 'mainnet'
- [ ] Testnet used for staging

```typescript
const mode = process.env.AGIRAILS_MODE;
if (!['mock', 'testnet', 'mainnet'].includes(mode)) {
  throw new Error('Invalid AGIRAILS_MODE');
}
```

### 2.4 RPC Configuration
- [ ] Using private RPC endpoint
- [ ] Rate limits understood
- [ ] Backup endpoints configured

```typescript
const rpcUrls = [
  process.env.PRIMARY_RPC_URL,
  process.env.BACKUP_RPC_URL,
];
```

### 2.5 Network Configuration
- [ ] Correct chain ID configured
- [ ] Contract addresses verified
- [ ] USDC address confirmed

---

## 3. Testing (4 items)

### 3.1 Test Coverage
- [ ] Unit tests pass
- [ ] Integration tests on testnet pass
- [ ] Edge cases covered
- [ ] >80% code coverage

```bash
npm run test:coverage
```

### 3.2 Error Scenarios
- [ ] Insufficient balance handled
- [ ] Network errors handled
- [ ] Invalid input handled
- [ ] Timeout scenarios handled

### 3.3 Load Testing
- [ ] Tested with realistic load
- [ ] No memory leaks detected
- [ ] Response times acceptable

### 3.4 Testnet Verification
- [ ] Full flow tested on testnet
- [ ] Same code as production
- [ ] Verified contract interactions

---

## 4. Monitoring (3 items)

### 4.1 Transaction Monitoring
- [ ] All transactions logged
- [ ] State changes tracked
- [ ] Failed transactions alerted

```typescript
// Use on-chain events via ethers (TransactionCreated, StateTransitioned, EscrowLinked)
// or your own indexer. The TS SDK does not expose a high-level events API.
```

### 4.2 Balance Monitoring
- [ ] Low balance alerts
- [ ] Unusual activity alerts
- [ ] Daily balance reports

```typescript
import { ethers } from 'ethers';

// Check balance periodically (mock mode returns wei)
setInterval(async () => {
  const balanceWei = await client.getBalance(client.getAddress());
  const balance = ethers.formatUnits(balanceWei, 6);
  if (parseFloat(balance) < 100) {
    alert.send('Low USDC balance', { balance });
  }
}, 60000);
```

### 4.3 Error Tracking
- [ ] Sentry or similar configured
- [ ] Errors categorized
- [ ] Alerts for critical errors

---

## 5. Operations (3 items)

### 5.1 Incident Response
- [ ] Response plan documented
- [ ] Escalation contacts listed
- [ ] Recovery procedures tested

### 5.2 Key Management
- [ ] Rotation procedure documented
- [ ] Emergency revocation possible
- [ ] Backup keys secured

### 5.3 Documentation
- [ ] Runbook created
- [ ] Architecture documented
- [ ] On-call procedures defined

---

## Final Verification

Before flipping to production:

```bash
# 1. Verify environment
echo $AGIRAILS_MODE  # Should be 'mainnet'
echo $PRIVATE_KEY    # Should be set (don't print value!)

# 2. Verify contracts
cast call $KERNEL_ADDRESS "owner()" --rpc-url $RPC_URL

# 3. Verify balance
cast call $USDC_ADDRESS "balanceOf(address)" $MY_ADDRESS --rpc-url $RPC_URL

# 4. Run final test (small amount)
npm run test:mainnet:smoke
```

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Security | | | |
| Operations | | | |
