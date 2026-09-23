"""In-process verification of fulfill_upgrade + gold->Messages against the preview DB."""
import asyncio
import os
import sys

sys.path.insert(0, "/app/backend")
os.chdir("/app/backend")

import server  # noqa: E402


async def main():
    db = server.db

    # --- 1. upgrade fulfilment: existing valid non-VIP ticket becomes VIP, same code ---
    t = await db.tickets.find_one({"status": "valid", "tier_name": {"$not": {"$regex": "VIP", "$options": "i"}}})
    assert t, "no valid standard ticket in preview DB"
    old_tier = t["tier_id"]
    order = {
        "id": "testupgrade" + server.new_id()[:20],
        "kind": "upgrade",
        "buyer_email": "test_upgrade_inproc@example.com",
        "amount_czk": 400,
        "upgrade_ticket_code": t["code"],
        "upgrade_vip_tier_id": "VIP_TEST_TIER",
    }
    # bypass email send to avoid external calls
    async def no_email(**kw):
        return {"ok": True, "skipped": True}
    orig_send = server.send_email
    async def no_capi(o):
        return None
    orig_capi = server.send_capi_purchase
    server.send_email = no_email
    server.send_capi_purchase = no_capi
    try:
        await server.fulfill_upgrade(order)
        t2 = await db.tickets.find_one({"code": t["code"]})
        assert t2["tier_name"] == "VIP Table Ticket", t2["tier_name"]
        assert t2["tier_id"] == "VIP_TEST_TIER"
        assert t2["upgraded"] is True and t2["upgrade_order_id"] == order["id"]
        # idempotent: second call must not duplicate/break
        await server.fulfill_upgrade(order)
        t3 = await db.tickets.find_one({"code": t["code"]})
        assert t3["tier_name"] == "VIP Table Ticket"
        print("UPGRADE FULFIL OK:", t["code"], old_tier[:8], "-> VIP")

        # --- 2. gold fulfilment creates Messages entry + per-guest tickets ---
        gold_tier = await db.ticket_tiers.find_one({"id": "goldtest111111111111111111111111"})
        gold_order = {
            "id": "testgold" + server.new_id()[:22],
            "created_at": server.utcnow().isoformat(), "updated_at": server.utcnow().isoformat(),
            "event_id": gold_tier["event_id"], "event_name": "TEST EVENT",
            "tier_id": gold_tier["id"], "tier_name": "VIP GOLD",
            "quantity": 4, "tickets_per_unit": 1, "amount_czk": 7595, "list_price_czk": 0,
            "unit_price_czk": 1899, "promo_code": None, "discount_percent": None,
            "currency": "CZK", "buyer_name": "TEST Gold Inproc", "buyer_email": "test_gold_inproc@example.com",
            "buyer_phone": "+420777999888", "payment_status": "created",
            "fulfillment_status": "pending",
        }
        await db.orders.insert_one(gold_order)
        await server.fulfill_order(gold_order["id"])
        tickets = await db.tickets.find({"order_id": gold_order["id"]}).to_list(10)
        assert len(tickets) == 4, len(tickets)
        msg = await db.messages.find_one({"order_id": gold_order["id"], "topic": "VIP GOLD TABLE"})
        assert msg and msg["guests"] == 4 and msg["phone"] == "+420777999888", msg
        print("GOLD FULFIL OK: 4 tickets + message", msg["id"][:8])
        # idempotency: second fulfill must not create more tickets/messages
        await server.fulfill_order(gold_order["id"])
        assert await db.tickets.count_documents({"order_id": gold_order["id"]}) == 4
        assert await db.messages.count_documents({"order_id": gold_order["id"]}) == 1
        print("GOLD IDEMPOTENT OK")

        # cleanup
        await db.tickets.update_one({"code": t["code"]}, {"$set": {"tier_id": old_tier, "tier_name": t["tier_name"]},
                                                           "$unset": {"upgraded": "", "upgraded_at": "", "upgrade_order_id": ""}})
        await db.tickets.delete_many({"order_id": gold_order["id"]})
        await db.orders.delete_one({"id": gold_order["id"]})
        await db.messages.delete_one({"order_id": gold_order["id"]})
        print("CLEANUP OK")
    finally:
        server.send_email = orig_send
        server.send_capi_purchase = orig_capi


asyncio.run(main())
