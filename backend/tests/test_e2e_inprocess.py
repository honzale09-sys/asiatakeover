"""In-process end-to-end: order → payment (guarded simulation provider) → fulfilment → QR → scanner → upgrade → Gold.
Runs the real FastAPI app against the preview DB with Teya disabled and external side effects (email, Meta CAPI) recorded.
Usage: python tests/test_e2e_inprocess.py   (or pytest)"""
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
BUYER = {"name": "E2E Inproc", "email": "e2e-inproc@example.com", "phone": "+420777000111"}
UA = {"User-Agent": "Mozilla/5.0 (E2E in-process)"}

recorded = {"emails": [], "capi": [], "ticket_emails": []}


async def fake_send_email(*, to, subject, html):
    recorded["emails"].append((to, subject))
    return {"id": "fake"}


async def fake_capi(order):
    recorded["capi"].append(order["id"])


async def fake_ticket_email(order_id):
    recorded["ticket_emails"].append(order_id)


def ok(msg):
    print(f"  ✔ {msg}", flush=True)


async def pay(c, order_id, action="paid"):
    r = await c.post("/api/payments/sim/action", json={"order_id": order_id, "action": action})
    assert r.status_code == 200, r.text
    return r.json()["payment_status"]


async def main():
    server.TEYA_CLIENT_ID = ""  # force the guarded simulation provider (preview only)
    server.send_email = fake_send_email
    server.send_capi_purchase = fake_capi
    server.send_ticket_email_with_retry = fake_ticket_email
    server._rate_hits.clear()
    assert not server.teya_configured() and server.payment_sim_allowed(), "sim provider must be active for this test"
    db = server.db
    created_orders = []

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="https://testserver", headers=UA) as c:
        site = (await c.get("/api/site")).json()
        tiers = site["tiers"]
        by_kind = lambda pred: [t for t in tiers if pred(t["name"].upper())]  # noqa: E731
        ga = sorted(by_kind(lambda n: "VIP" not in n and "GROUP" not in n), key=lambda t: t["price_czk"])
        std = next(t for t in ga if t["sold"] < t["capacity"])
        gold = by_kind(lambda n: "GOLD" in n)[0]
        group = next((t for t in by_kind(lambda n: "GROUP" in n) if t["sold"] < t["capacity"]), None)
        stats0 = None

        # admin session
        r = await c.post("/api/auth/login", json=ADMIN)
        assert r.status_code == 200, r.text
        stats0 = (await c.get("/api/admin/stats")).json()

        print("\n[1] Standard purchase with promo → paid → 2 QR tickets", flush=True)
        r = await c.post("/api/orders/create", json={**BUYER, "tier_id": std["id"], "quantity": 2, "promo_code": "MZYPL5BKOD"})
        assert r.status_code == 200, r.text
        o1 = r.json()
        created_orders.append(o1["order_id"])
        expected_unit = max(1, round(std["price_czk"] * 5 / 100))
        assert o1["mode"] == "simulation" and o1["amount_czk"] == expected_unit * 2, o1
        ok(f"order created server-priced: {std['price_czk']}×2 with −95% → {o1['amount_czk']} Kč")
        r = await c.get(f"/api/orders/{o1['order_id']}/tickets")
        assert r.status_code == 403, "tickets must NOT exist before payment"
        ok("no tickets before payment (403)")
        assert await pay(c, o1["order_id"]) == "paid"
        st = (await c.get(f"/api/orders/{o1['order_id']}/status")).json()
        assert st["payment_status"] == "paid" and st["tier_name"] == "Standard Ticket"
        tks = (await c.get(f"/api/orders/{o1['order_id']}/tickets")).json()["tickets"]
        assert len(tks) == 2 and all(t["qr"].startswith("data:image/png") or len(t["qr"]) > 100 for t in tks)
        assert {t["tier_name"] for t in tks} == {"Standard Ticket"} and all(t["status"] == "valid" for t in tks)
        await asyncio.sleep(0.05)
        assert o1["order_id"] in recorded["ticket_emails"] and o1["order_id"] in recorded["capi"]
        ok("paid → 2 Standard QR tickets issued, ticket email queued, Meta Purchase sent")
        assert await pay(c, o1["order_id"]) == "paid"
        assert len((await c.get(f"/api/orders/{o1['order_id']}/tickets")).json()["tickets"]) == 2
        ok("duplicate payment notification is idempotent (still 2 tickets)")

        print("\n[2] Scanner: lookup → check-in → duplicate rejected", flush=True)
        code_a, code_b = tks[0]["code"], tks[1]["code"]
        r = await c.post("/api/scan/lookup", json={"code": code_a})
        assert r.json()["result"] == "valid"
        assert (await c.post("/api/scan/checkin", json={"code": code_a})).json()["result"] == "valid"
        assert (await c.post("/api/scan/checkin", json={"code": code_a})).json()["result"] == "used"
        assert (await c.post("/api/scan/lookup", json={"code": "ATF-NOPE00"})).json()["result"] == "invalid"
        ok(f"{code_a}: valid → admitted → duplicate USED; unknown code INVALID")

        print("\n[3] Upgrade Standard → VIP (400 Kč, same QR)", flush=True)
        r = await c.post("/api/upgrade/check", json={"code": code_a})
        assert r.status_code == 400 and "checked in" in r.json()["detail"], r.text
        ok("already checked-in ticket cannot be upgraded")
        r = await c.post("/api/upgrade/check", json={"code": code_b.lower()})
        assert r.status_code == 200 and r.json()["price_czk"] == 400 and r.json()["code"] == code_b
        r = await c.post("/api/upgrade/create", json={**BUYER, "code": code_b})
        assert r.status_code == 200, r.text
        up = r.json()
        created_orders.append(up["order_id"])
        assert up["amount_czk"] == 400 and up["mode"] == "simulation"
        assert await pay(c, up["order_id"]) == "paid"
        t2 = await db.tickets.find_one({"code": code_b}, {"_id": 0})
        assert t2["tier_name"] == "VIP Table Ticket" and t2.get("upgraded") and t2["upgrade_order_id"] == up["order_id"]
        assert t2["order_id"] == o1["order_id"] and t2["status"] == "valid"
        assert await db.tickets.count_documents({"order_id": up["order_id"]}) == 0, "upgrade must not mint a new ticket"
        ok(f"{code_b} re-labelled to VIP Table Ticket — same code, no new QR")
        st = (await c.get(f"/api/orders/{up['order_id']}/tickets")).json()["tickets"]
        assert len(st) == 1 and st[0]["code"] == code_b and st[0]["tier_name"] == "VIP Table Ticket"
        ok("/success for the upgrade order shows the same ticket as VIP")
        r = await c.post("/api/scan/lookup", json={"code": code_b})
        assert r.json()["result"] == "valid" and r.json()["ticket"]["tier_name"] == "VIP Table Ticket"
        ok("scanner sees the upgraded ticket as VIP")
        r = await c.post("/api/upgrade/check", json={"code": code_b})
        assert r.status_code == 400 and "already VIP" in r.json()["detail"]
        assert any("VIP" in s for _, s in recorded["emails"]), recorded["emails"]
        ok("second upgrade rejected (already VIP); confirmation email sent")
        r = await c.post("/api/upgrade/check", json={"code": "ATF-ZZZZ99"})
        assert r.status_code == 404
        ok("unknown code → 404")

        print("\n[4] VIP GOLD table (5 guests) → tickets + admin Messages entry", flush=True)
        r = await c.post("/api/orders/create", json={**BUYER, "tier_id": gold["id"], "quantity": 5, "promo_code": "MZYPL5BKOD"})
        assert r.status_code == 400 and "Gold" in r.json()["detail"]
        ok("promo codes rejected on Gold")
        r = await c.post("/api/orders/create", json={**BUYER, "tier_id": gold["id"], "quantity": 5})
        assert r.status_code == 200, r.text
        g = r.json()
        created_orders.append(g["order_id"])
        assert g["amount_czk"] == 3999 + 899 * 5, g
        assert await pay(c, g["order_id"]) == "paid"
        gt = (await c.get(f"/api/orders/{g['order_id']}/tickets")).json()["tickets"]
        assert len(gt) == 5 and {t["tier_name"] for t in gt} == {"VIP GOLD"}
        msgs = (await c.get("/api/admin/messages")).json()
        gm = [m for m in msgs if m.get("order_id") == g["order_id"]]
        assert len(gm) == 1 and gm[0]["topic"] == "VIP GOLD TABLE" and gm[0]["guests"] == 5 and gm[0]["status"] == "new"
        ok(f"8 494 Kč → 5 VIP GOLD tickets + 'VIP GOLD TABLE' reservation in Messages ({gm[0]['id'][:8]})")
        assert await pay(c, g["order_id"]) == "paid"
        assert len([m for m in (await c.get("/api/admin/messages")).json() if m.get("order_id") == g["order_id"]]) == 1
        ok("Gold re-notification idempotent (1 message)")
        r = await c.put(f"/api/admin/messages/{gm[0]['id']}", json={"floor": "Seoul Floor (7th)", "notes": "e2e note", "status": "contacted"})
        assert r.status_code == 200
        r = await c.put(f"/api/admin/messages/{gm[0]['id']}", json={"floor": "Mainstream Floor (6th)"})
        assert r.status_code == 400
        m2 = next(m for m in (await c.get("/api/admin/messages")).json() if m["id"] == gm[0]["id"])
        assert m2["floor"] == "Seoul Floor (7th)" and m2["notes"] == "e2e note" and m2["status"] == "contacted"
        ok("table moved to Seoul + note + status saved; Mainstream rejected")
        r = await c.post("/api/scan/lookup", json={"code": gt[0]["code"]})
        assert r.json()["result"] == "valid" and r.json()["ticket"]["tier_name"] == "VIP GOLD"
        ok("scanner shows VIP GOLD")

        if group:
            print("\n[5] GROUP OF 4 → 4 Standard tickets", flush=True)
            r = await c.post("/api/orders/create", json={**BUYER, "tier_id": group["id"], "quantity": 1})
            assert r.status_code == 200, r.text
            gr = r.json()
            created_orders.append(gr["order_id"])
            assert gr["amount_czk"] == group["price_czk"]
            assert await pay(c, gr["order_id"]) == "paid"
            grt = (await c.get(f"/api/orders/{gr['order_id']}/tickets")).json()["tickets"]
            assert len(grt) == 4 and {t["tier_name"] for t in grt} == {"Standard Ticket"}
            ok("1 group unit → 4 Standard QR tickets")

        print("\n[6] Failed / abandoned payment never issues tickets", flush=True)
        r = await c.post("/api/orders/create", json={**BUYER, "tier_id": std["id"], "quantity": 1})
        assert r.status_code == 200, r.text
        bad = r.json()
        created_orders.append(bad["order_id"])
        assert await pay(c, bad["order_id"], "failed") != "paid"
        assert (await c.get(f"/api/orders/{bad['order_id']}/tickets")).status_code == 403
        assert await db.tickets.count_documents({"order_id": bad["order_id"]}) == 0
        ok("cancelled payment → status not paid, no tickets, 403 on /tickets")
        r = await c.post("/api/orders/create", json={**BUYER, "tier_id": std["id"], "quantity": 1})
        assert r.status_code == 200, r.text
        abandoned = r.json()
        created_orders.append(abandoned["order_id"])
        assert (await c.get(f"/api/orders/{abandoned['order_id']}/status")).json()["payment_status"] == "created"
        ok("abandoned checkout stays 'created' with no tickets")

        print("\n[7] Admin stats & orders reflect the paid orders", flush=True)
        stats1 = (await c.get("/api/admin/stats")).json()
        paid_total = o1["amount_czk"] + 400 + g["amount_czk"] + (group["price_czk"] if group else 0)
        assert stats1["revenue_czk"] - stats0["revenue_czk"] == paid_total, (stats1["revenue_czk"], stats0["revenue_czk"], paid_total)
        assert stats1["tickets_sold"] - stats0["tickets_sold"] == 2 + 5 + (4 if group else 0)
        assert stats1["checked_in"] - stats0["checked_in"] == 1
        assert stats1["categories"]["vip"]["sold"] - stats0["categories"]["vip"]["sold"] == 1, "upgraded ticket must count as VIP"
        assert stats1["categories"]["standard"]["sold"] - stats0["categories"]["standard"]["sold"] == 1 + (4 if group else 0)
        ok(f"revenue +{paid_total} Kč, tickets +{2 + 5 + (4 if group else 0)}, checked-in +1, VIP +1 / Standard −1 after upgrade")
        orders = (await c.get("/api/admin/orders")).json()
        visible = {o["id"]: o for o in orders}
        assert o1["order_id"] in visible and up["order_id"] in visible and g["order_id"] in visible
        assert visible[bad["order_id"]]["payment_status"] == "cancelled", "failed payments stay visible as cancelled"
        assert abandoned["order_id"] not in visible
        unpaid = {o["id"] for o in (await c.get("/api/admin/orders?include_unpaid=1")).json()}
        assert abandoned["order_id"] in unpaid
        assert visible[up["order_id"]]["tier_name"] == "VIP Upgrade" and visible[up["order_id"]]["amount_czk"] == 400
        ok("admin orders: paid + cancelled visible, abandoned hidden by default and shown with Abandoned ON, upgrade listed as 'VIP Upgrade' 400 Kč")

        print("\n[8] Cleanup via admin delete", flush=True)
        for oid in created_orders:
            r = await c.delete(f"/api/admin/orders/{oid}")
            assert r.status_code == 200, r.text
        await db.messages.delete_many({"order_id": {"$in": created_orders}})
        await db.sim_payments.delete_many({"order_id": {"$in": created_orders}})
        for code in (code_a, code_b):
            assert (await c.post("/api/scan/lookup", json={"code": code})).json()["result"] == "invalid"
        stats2 = (await c.get("/api/admin/stats")).json()
        assert stats2["revenue_czk"] == stats0["revenue_czk"] and stats2["tickets_sold"] == stats0["tickets_sold"]
        ok("all test orders/tickets/messages removed — deleted QR codes scan as INVALID, stats back to baseline")

    print("\nE2E IN-PROCESS PASS", flush=True)


def test_e2e_inprocess():
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
