"""In-process test: Standard/VIP guest lists with quantity + door classification (wristband/gift) + check-in report.
Runs the real FastAPI app against the preview DB with Teya disabled and emails/CAPI recorded.
Usage: python tests/test_guest_list_door.py   (or pytest)"""
import asyncio
import os
import sys

sys.path.insert(0, "/app/backend")
os.chdir("/app/backend")
os.environ["ALLOW_PAYMENT_SIM"] = "1"

import httpx  # noqa: E402
from dotenv import dotenv_values  # noqa: E402

import server  # noqa: E402

_ENV = {**dotenv_values("/app/backend/.env"), **os.environ}
ADMIN = {"email": _ENV["ADMIN_EMAIL"], "password": _ENV["ADMIN_PASSWORD"]}
BUYER = {"name": "Door Test", "email": "door-test@example.com", "phone": "+420777000222"}
UA = {"User-Agent": "Mozilla/5.0 (door test)"}

recorded = {"ticket_emails": []}


async def fake_send_email(*, to, subject, html):
    return {"id": "fake"}


async def fake_capi(order):
    return None


async def fake_ticket_email(order_id):
    recorded["ticket_emails"].append(order_id)


def ok(msg):
    print(f"  ✔ {msg}", flush=True)


async def scan(c, code):
    return (await c.post("/api/scan/checkin", json={"code": code})).json()


async def main():
    # rebind Mongo to the current event loop (this file may run after other in-process tests)
    from motor.motor_asyncio import AsyncIOMotorClient
    server.client = AsyncIOMotorClient(_ENV["MONGO_URL"])
    server.db = server.client[_ENV["DB_NAME"]]
    server.TEYA_CLIENT_ID = ""
    server.send_email = fake_send_email
    server.send_capi_purchase = fake_capi
    server.send_ticket_email_with_retry = fake_ticket_email
    server._rate_hits.clear()
    assert not server.teya_configured() and server.payment_sim_allowed()
    db = server.db
    created = []

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="https://testserver", headers=UA) as c:
        assert (await c.post("/api/auth/login", json=ADMIN)).status_code == 200
        stats0 = (await c.get("/api/admin/stats")).json()
        site = (await c.get("/api/site")).json()
        vip_tier = next(t for t in site["tiers"] if "VIP" in t["name"].upper() and "GOLD" not in t["name"].upper() and t["sold"] < t["capacity"])

        print("\n[1] Standard guest list, quantity 3 → 3 separate single-use QR codes", flush=True)
        r = await c.post("/api/admin/guest-list", json={"email": "guest-std@example.com", "quantity": 3, "category": "standard"})
        assert r.status_code == 200, r.text
        std_gl = r.json()
        assert std_gl["quantity"] == 3 and len(set(std_gl["codes"])) == 3, std_gl
        order_id = (await db.tickets.find_one({"code": std_gl["codes"][0]}))["order_id"]
        created.append(order_id)
        tickets = (await c.get(f"/api/orders/{order_id}/tickets")).json()["tickets"]
        assert len(tickets) == 3 and len({t["qr"] for t in tickets}) == 3, "each ticket must carry its own QR"
        assert recorded["ticket_emails"].count(order_id) == 1, "all 3 tickets go out in ONE email"
        ok("3 tickets, 3 different QR codes, one email")

        stats1 = (await c.get("/api/admin/stats")).json()
        assert stats1["categories"]["standard_guest_list"]["sent"] - stats0["categories"]["standard_guest_list"]["sent"] == 3
        assert stats1["categories"]["vip_guest_list"]["sent"] == stats0["categories"]["vip_guest_list"]["sent"]
        # scoped to this test's own tickets so parallel workers cannot skew the counts
        assert await db.tickets.count_documents({"code": {"$in": std_gl["codes"]}, "tier_name": "Standard Guest List"}) == 3
        assert (await db.orders.find_one({"id": order_id}, {"_id": 0}))["amount_czk"] == 0, "guest tickets must not touch revenue"
        assert {g["tier_name"] for g in stats1["guest_tickets"] if g["code"] in std_gl["codes"]} == {"Standard Guest List"}
        ok("stats count individual tickets (+3), revenue unchanged")

        print("\n[2] Door: STANDARD wristband, no gift, single-use per QR", flush=True)
        a, b, cc = std_gl["codes"]
        r1 = await scan(c, a)
        assert r1["result"] == "valid" and r1["admission"] == {"wristband": "standard", "gift": False}, r1
        ok("first scan → STANDARD, no surprise gift")
        r1b = await scan(c, a)
        assert r1b["result"] == "used" and r1b["reason"] == "ALREADY USED" and r1b["ticket"]["checked_in_at"], r1b
        ok(f"second scan → DECLINED / ALREADY USED at {r1b['ticket']['checked_in_at'][:19]}")
        assert (await c.post("/api/scan/lookup", json={"code": cc})).json()["result"] == "valid", "other tickets stay valid"
        r2 = await scan(c, b)
        assert r2["result"] == "valid", r2
        ok("scanning one QR never checks in the others")

        print("\n[3] VIP guest list, quantity 2 → VIP wristband, no gift", flush=True)
        r = await c.post("/api/admin/guest-list", json={"email": "guest-vip@example.com", "quantity": 2, "category": "vip"})
        vip_gl = r.json()
        assert len(set(vip_gl["codes"])) == 2
        created.append((await db.tickets.find_one({"code": vip_gl["codes"][0]}))["order_id"])
        rv = await scan(c, vip_gl["codes"][0])
        assert rv["result"] == "valid" and rv["admission"] == {"wristband": "vip", "gift": False}, rv
        ok("VIP guest list → VIP wristband, NO surprise gift")

        print("\n[4] Paid presale VIP → VIP wristband WITH gift", flush=True)
        r = await c.post("/api/orders/create", json={**BUYER, "tier_id": vip_tier["id"], "quantity": 1})
        paid_vip = r.json()
        created.append(paid_vip["order_id"])
        assert (await c.post("/api/payments/sim/action", json={"order_id": paid_vip["order_id"], "action": "paid"})).json()["payment_status"] == "paid"
        vip_code = (await c.get(f"/api/orders/{paid_vip['order_id']}/tickets")).json()["tickets"][0]["code"]
        rp = await scan(c, vip_code)
        assert rp["result"] == "valid" and rp["admission"] == {"wristband": "vip", "gift": True}, rp
        ok("paid VIP ticket → VIP wristband + SURPRISE GIFT")

        print("\n[5] Door VIP comp → VIP wristband, no gift", flush=True)
        r = await c.post("/api/admin/comp-tickets", json={"quantity": 1, "holder_name": "Door VIP", "category": "vip"})
        comp = r.json()
        created.append(comp["order_id"])
        rc = await scan(c, comp["tickets"][0]["code"])
        assert rc["result"] == "valid" and rc["admission"] == {"wristband": "vip", "gift": False}, rc
        ok("free door VIP → VIP wristband, NO gift")

        print("\n[6] Declines", flush=True)
        bad = (await c.post("/api/scan/checkin", json={"code": "ATF-NOPE99"})).json()
        assert bad["result"] == "invalid" and bad["reason"] == "INVALID", bad
        ok("unknown code → DECLINED / INVALID")

        print("\n[7] Check-in report counts individual tickets", flush=True)
        rep1 = (await c.get("/api/admin/checkin-report")).json()
        scanned = {a, b, vip_gl["codes"][0], vip_code, comp["tickets"][0]["code"]}
        in_report = {s["code"] for s in rep1["scans"]}
        assert scanned <= in_report, scanned - in_report
        assert await db.tickets.count_documents({"order_id": {"$in": created}}) == 3 + 2 + 1 + 1
        assert await db.tickets.count_documents({"code": {"$in": list(scanned)}, "status": "used"}) == 5
        by_tier = {r["tier_name"]: r for r in rep1["by_tier"]}
        assert by_tier["Standard Guest List"]["checked_in"] >= 2 and by_tier["Standard Guest List"]["sold"] >= 3
        ok(f"all 5 scanned tickets counted individually ({rep1['checked_in']} checked in overall), per-type rows correct")

        print("\n[8] Cleanup", flush=True)
        for oid in created:
            assert (await c.delete(f"/api/admin/orders/{oid}")).status_code == 200
        assert await db.tickets.count_documents({"order_id": {"$in": created}}) == 0
        assert await db.orders.count_documents({"id": {"$in": created}}) == 0
        await db.sim_payments.delete_many({"order_id": {"$in": created}})
        ok("all test guest/comp/paid orders and their tickets removed")

    print("\nGUEST LIST + DOOR PASS", flush=True)


def test_guest_list_and_door():
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
