"""
AGIRAILS SDK - Basic Payment Example

Run: python basic_payment.py

This example demonstrates:
- Creating an ACTPClient in mock mode
- Making a simple payment
- Checking transaction status
- Releasing payment
"""

import asyncio
from agirails import ACTPClient

# Addresses (any valid Ethereum addresses for mock mode)
REQUESTER_ADDRESS = "0x1111111111111111111111111111111111111111"
PROVIDER_ADDRESS = "0x2222222222222222222222222222222222222222"


async def main():
    print("=== AGIRAILS Basic Payment Example ===\n")

    # 1. Create client in mock mode (no real blockchain needed)
    print("1. Creating client...")
    client = await ACTPClient.create(
        mode="mock",
        requester_address=REQUESTER_ADDRESS,
    )
    print("   Client created in mock mode")
    print(f"   Address: {client.get_address()}\n")

    # 2. Check initial balance and mint if needed
    print("2. Checking balance...")
    balance = await client.get_balance(REQUESTER_ADDRESS)
    print(f"   Balance: {balance} wei")

    # 3. Mint test USDC if needed (mock mode only)
    if int(balance) < 100_000_000:  # Less than 100 USDC
        print("   Balance low, minting 1000 USDC...")
        await client.mint_tokens(REQUESTER_ADDRESS, "1000000000")  # 1000 * 10^6
        balance = await client.get_balance(REQUESTER_ADDRESS)
        print(f"   New balance: {balance} wei\n")
    else:
        print()

    # 4. Create a payment using Basic API
    print("3. Creating payment...")
    result = await client.basic.pay({
        "to": PROVIDER_ADDRESS,
        "amount": 25.00,
        "deadline": "+24h",
    })

    print("   Payment created!")
    print(f"   Transaction ID: {result.tx_id}")
    print(f"   State: {result.state}")
    print(f"   Amount: {result.amount}")
    print(f"   Deadline: {result.deadline}\n")

    # 5. Check status using Basic API
    print("4. Checking status...")
    status = await client.basic.check_status(result.tx_id)
    print(f"   Current state: {status.state}")
    print(f"   Can accept: {status.can_accept}")
    print(f"   Can complete: {status.can_complete}")
    print(f"   Can dispute: {status.can_dispute}\n")

    # 6. Provider delivers (using Standard API for state transition)
    print("5. Provider delivering...")
    await client.standard.transition_state(result.tx_id, "DELIVERED")
    print("   State transitioned to DELIVERED\n")

    # 7. Check updated status
    print("6. Checking updated status...")
    updated_status = await client.basic.check_status(result.tx_id)
    print(f"   Current state: {updated_status.state}")
    print(f"   Can dispute: {updated_status.can_dispute}\n")

    # 8. Release payment (using Standard API)
    # escrow_id equals tx_id in current implementation
    print("7. Releasing payment...")
    await client.standard.release_escrow(result.tx_id)
    print("   Payment released to provider!\n")

    # 9. Final status
    print("8. Final status...")
    final_status = await client.basic.check_status(result.tx_id)
    print(f"   State: {final_status.state}")
    print("   Transaction complete!\n")

    # 10. Check final balance
    print("9. Final balance...")
    final_balance = await client.get_balance(REQUESTER_ADDRESS)
    print(f"   Balance: {final_balance} wei")
    print("   (Paid 25 USDC + platform fee)\n")

    print("=== Example Complete ===")


if __name__ == "__main__":
    asyncio.run(main())
