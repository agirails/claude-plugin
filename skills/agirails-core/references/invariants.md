# ACTP Protocol Invariants

These 10 invariants must hold true at all times. Any violation indicates a critical bug.

## 1. Escrow Solvency

**Statement:** The escrow vault balance must always be greater than or equal to the sum of all active transaction amounts plus fees.

```
escrowVault.balance(USDC) ≥ Σ(all active transaction amounts + fees)
```

**Active States:** COMMITTED, IN_PROGRESS, DELIVERED, DISPUTED

**Test Pattern:**
```solidity
function invariant_escrowSolvency() public {
    uint256 escrowBalance = usdc.balanceOf(address(escrowVault));
    uint256 totalLocked = 0;

    for (uint i = 0; i < allTransactionIds.length; i++) {
        Transaction memory tx = getTransaction(allTransactionIds[i]);
        if (tx.state >= State.COMMITTED && tx.state <= State.DISPUTED) {
            totalLocked += tx.amount + tx.fee;
        }
    }

    assertGe(escrowBalance, totalLocked, "Escrow insolvent");
}
```

**Violation Causes:**
- Bug in fund release logic
- Reentrancy attack
- Arithmetic overflow

---

## 2. State Monotonicity

**Statement:** State transitions are strictly one-way. No transaction can transition to a previous state.

```
∀ transitions: state_new > state_old
```

**Exception:** None. This is absolute.

**Test Pattern:**
```solidity
function invariant_stateMonotonicity() public {
    for (uint i = 0; i < allTransactionIds.length; i++) {
        Transaction memory tx = getTransaction(allTransactionIds[i]);
        assertGe(
            uint8(tx.state),
            previousStates[allTransactionIds[i]],
            "State went backwards"
        );
        previousStates[allTransactionIds[i]] = uint8(tx.state);
    }
}
```

**Violation Causes:**
- Logic error in transition validation
- Storage corruption
- Malicious upgrade (if upgradeable)

---

## 3. Fee Bounds

**Statement:** Platform fee percentage never exceeds the maximum cap (5%).

```
platformFeeBps ≤ MAX_PLATFORM_FEE_CAP (500 = 5%)
```

**Test Pattern:**
```solidity
function invariant_feeBounds() public {
    assertLe(
        kernel.platformFeeBps(),
        kernel.MAX_PLATFORM_FEE_CAP(),
        "Fee exceeds cap"
    );
}
```

**Current Values:**
- `platformFeeBps`: 100 (1%)
- `MAX_PLATFORM_FEE_CAP`: 500 (5%)
- `MIN_FEE_USDC`: 50000 (6 decimals = $0.05)

---

## 4. Deadline Enforcement

**Statement:** Transactions cannot progress to DELIVERED state after deadline has passed.

```
transitionState(DELIVERED) requires: block.timestamp ≤ tx.deadline
```

**Test Pattern:**
```solidity
function test_deadlineEnforcement() public {
    bytes32 txId = createTransaction(...);
    linkEscrow(txId);

    // Warp past deadline
    vm.warp(block.timestamp + deadline + 1);

    // Should revert
    vm.expectRevert("Deadline passed");
    transitionState(txId, State.DELIVERED);
}
```

**Allowed After Deadline:**
- Cancel transaction
- View transaction state
- (Nothing else)

---

## 5. Access Control

**Statement:** Only authorized parties can trigger state transitions.

| Action | Authorized Caller |
|--------|-------------------|
| createTransaction | Anyone |
| linkEscrow | Requester only |
| transitionState(QUOTED) | Provider only |
| transitionState(IN_PROGRESS) | Provider only |
| transitionState(DELIVERED) | Provider only |
| releaseEscrow | Requester only |
| transitionState(DISPUTED) | Requester or Provider |
| resolveDispute | Mediator only |
| cancel | Requester (INITIATED/QUOTED), Either (COMMITTED) |
| pause | Admin only |
| setFee | Admin only (with timelock) |

**Test Pattern:**
```solidity
function test_accessControl_releaseEscrow() public {
    bytes32 txId = createTransaction(requester, provider, ...);
    linkEscrow(txId);
    transitionState(txId, State.DELIVERED);

    // Provider tries to release (should fail)
    vm.prank(provider);
    vm.expectRevert("Not authorized");
    releaseEscrow(txId);

    // Requester releases (should succeed)
    vm.prank(requester);
    releaseEscrow(txId);
}
```

---

## 6. Dispute Window

**Statement:** Funds cannot be finalized during an active dispute window.

```
releaseEscrow() auto-trigger requires: block.timestamp > tx.deliveredAt + disputeWindow
```

**Test Pattern:**
```solidity
function test_disputeWindow() public {
    bytes32 txId = createAndDeliver(...);

    // Try to auto-finalize during window
    vm.warp(tx.deliveredAt + disputeWindow - 1);
    vm.expectRevert("Dispute window active");
    autoFinalize(txId);

    // After window, should work
    vm.warp(tx.deliveredAt + disputeWindow + 1);
    autoFinalize(txId); // Success
}
```

**Default Window:** 48 hours (172800 seconds)
**Max Window:** 30 days
**Min Window:** 1 hour

---

## 7. Pause Effectiveness

**Statement:** All state-changing transactions are blocked when contract is paused.

```
paused = true → all mutations revert
```

**Allowed When Paused:**
- View functions (getTransaction, getBalance, etc.)
- Nothing else

**Test Pattern:**
```solidity
function test_pauseEffectiveness() public {
    kernel.pause();

    vm.expectRevert("Pausable: paused");
    createTransaction(...);

    vm.expectRevert("Pausable: paused");
    linkEscrow(...);

    // View still works
    Transaction memory tx = getTransaction(existingTxId); // OK
}
```

---

## 8. Economic Parameter Delays

**Statement:** Changes to economic parameters (fees) require a minimum timelock delay.

```
ECONOMIC_PARAM_DELAY = 2 days
```

**Process:**
1. Admin calls `scheduleFeeChange(newFee)`
2. Wait 2 days
3. Admin calls `executeFeeChange()`
4. New fee takes effect

**Test Pattern:**
```solidity
function test_economicDelay() public {
    kernel.scheduleFeeChange(200); // 2%

    // Try immediate execution (should fail)
    vm.expectRevert("Timelock not expired");
    kernel.executeFeeChange();

    // After delay (should succeed)
    vm.warp(block.timestamp + 2 days + 1);
    kernel.executeFeeChange();
    assertEq(kernel.platformFeeBps(), 200);
}
```

---

## 9. Transaction Uniqueness

**Statement:** Each transaction ID maps to exactly one transaction. No collisions or overwrites.

```
∀ txId: mapping[txId] → exactly one Transaction OR empty
```

**ID Generation:**
```solidity
txId = keccak256(abi.encodePacked(
    requester,
    provider,
    amount,
    nonce,
    block.timestamp
))
```

**Test Pattern:**
```solidity
function invariant_transactionUniqueness() public {
    for (uint i = 0; i < allTransactionIds.length; i++) {
        for (uint j = i + 1; j < allTransactionIds.length; j++) {
            assertTrue(
                allTransactionIds[i] != allTransactionIds[j],
                "Duplicate transaction ID"
            );
        }
    }
}
```

---

## 10. Fund Conservation

**Statement:** Total USDC entering the system equals total USDC leaving. No funds created or destroyed.

```
Σ(deposits) = Σ(provider_payments) + Σ(requester_refunds) + Σ(platform_fees)
```

**Test Pattern:**
```solidity
function invariant_fundConservation() public {
    uint256 totalDeposited = sumAllDeposits();
    uint256 totalWithdrawn = sumAllWithdrawals();
    uint256 currentBalance = usdc.balanceOf(address(escrowVault));

    assertEq(
        totalDeposited,
        totalWithdrawn + currentBalance,
        "Funds not conserved"
    );
}
```

**Verification Points:**
- After every state transition
- After every deposit
- After every withdrawal
- In daily reconciliation

---

## Running Invariant Tests

```bash
# Foundry invariant testing
forge test --match-contract InvariantTest -vvv

# With specific seed for reproducibility
forge test --match-contract InvariantTest --fuzz-seed 12345

# Generate coverage
forge coverage --match-contract InvariantTest
```

## Monitoring in Production

Key metrics to monitor:
- `escrow_balance` vs `sum_active_amounts` (Invariant 1)
- `state_transition_events` for backwards moves (Invariant 2)
- `fee_changes` timing (Invariant 8)
- `pause_events` and blocked transactions (Invariant 7)

Alert thresholds:
- Solvency ratio < 100%: CRITICAL
- Backwards state transition: CRITICAL
- Fee change without delay: CRITICAL
- Unexpected pause: HIGH
