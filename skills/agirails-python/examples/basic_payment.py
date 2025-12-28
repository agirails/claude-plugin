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
from agirails.errors import InsufficientBalanceError

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
    print("   Client created in mock mode\n")

    # 2. Check initial balance
    print("2. Checking balance...")
    balance = await client.basic.get_balance()
    print(f"   Balance: {balance} USDC")

    # 3. Mint test USDC if needed
    if float(balance) < 100:
        print("   Balance low, minting 1000 USDC...")
        await client.mock.mint(REQUESTER_ADDRESS, 1000)
        balance = await client.basic.get_balance()
        print(f"   New balance: {balance} USDC\n")
    else:
        print()

    # 4. Create a payment
    print("3. Creating payment...")
    try:
        result = await client.basic.pay({
            "to": PROVIDER_ADDRESS,
            "amount": 25.00,
            "deadline": "24h",
            "service_description": "AI image generation service",
        })

        print("   Payment created!")
        print(f"   Transaction ID: {result.tx_id}")
        print(f"   State: {result.state}")
        print(f"   Amount: {result.amount} USDC")
        print(f"   Fee: {result.fee} USDC")
        print(f"   Deadline: {result.deadline.isoformat()}\n")

        # 5. Check status
        print("4. Checking status...")
        status = await client.basic.check_status(result.tx_id)
        print(f"   Current state: {status.state}")
        print(f"   Can release: {status.can_release}")
        print(f"   Can dispute: {status.can_dispute}")
        print(f"   Can cancel: {status.can_cancel}\n")

        # 6. Simulate provider delivering (in real app, provider does this)
        print("5. Simulating delivery...")
        await client.standard.transition_state(
            result.tx_id,
            "DELIVERED",
            metadata={
                "result_hash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                "result_url": "ipfs://QmExample...",
            }
        )
        print("   Provider marked as DELIVERED\n")

        # 7. Check status again
        print("6. Checking updated status...")
        updated_status = await client.basic.check_status(result.tx_id)
        print(f"   Current state: {updated_status.state}")
        print(f"   Can release: {updated_status.can_release}")
        print(f"   Time to auto-settle: {updated_status.time_to_auto_settle}\n")

        # 8. Release payment
        if updated_status.can_release:
            print("7. Releasing payment...")
            await client.basic.release(result.tx_id)
            print("   Payment released to provider!\n")

        # 9. Final status
        print("8. Final status...")
        final_status = await client.basic.check_status(result.tx_id)
        print(f"   State: {final_status.state}")
        print(f"   Is terminal: {final_status.is_terminal}\n")

        # 10. Check final balance
        print("9. Final balance...")
        final_balance = await client.basic.get_balance()
        print(f"   Balance: {final_balance} USDC")
        print(f"   (Started with {balance}, paid 25 + fee)\n")

    except InsufficientBalanceError as e:
        print(f"   Error: Insufficient balance")
        print(f"   Need: {e.required} USDC")
        print(f"   Have: {e.available} USDC")

    print("=== Example Complete ===")


if __name__ == "__main__":
    asyncio.run(main())
