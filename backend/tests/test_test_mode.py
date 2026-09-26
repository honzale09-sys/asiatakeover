"""In-process test: private admin TEST MODE — 6 labelled single-use test QRs that use the real
scanner flow but must never touch real orders, revenue, ticket sales, check-ins or statistics.
Usage: python tests/test_test_mode.py   (or pytest)"""
import asyncio
import os
import sys

sys.path.insert(0, "/app/backend")
os.chdir("/app/backend")

import httpx  # noqa: E402
from dotenv import dotenv_values  # noqa: E402

import server  # noqa: E402

_ENV = {**dotenv_values("/app/backend/.env"), **os.environ}
ADMIN = {"email": _ENV["ADMIN_EMAIL"], "password": _ENV["ADMIN_PASSWORD"]}
UA = {"User-Agent": "Mozilla/5.0 (test mode)"}

EXPECTED = {
    "paid_standard": ("standard", False),
    "paid_standard_discount": ("standard", False),
    "paid_vip": ("vip", True),
    "paid_vip_discount": ("vip", True),
    "standard_guest_list": ("standard", False),
    "vip_guest_list": ("vip", False),
}


def ok(msg):
    print(f"  ✔ {msg}", flush=True)


async def main():
    from motor.motor_asyncio import AsyncIOMotorClient
    server.client = AsyncIOMotorClient(_ENV["MONGO_URL"])
    server.db = server.client[_ENV["DB_NAME"]]
    db = server.db

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="https://testserver", headers=UA) as c:
        assert (await c.post("/api/auth/login", json=ADMIN)).status_code == 200
        await c.delete("/api/admin/test-tickets")

        print("\n[1] Generate all 6 labelled test tickets", flush=True)
        rows = (await c.post("/api/admin/test-tickets/generate-all")).json()
        codes = [r["code"] for r in rows]
        assert len(rows) == 6 and len(set(codes)) == 6, rows
        for r in rows:
            assert (r["wristband"], r["gift"]) == EXPECTED[r["kind"]], r
            assert r["tier_name"].startswith("TEST ") and r["status"] == "valid", r
        ok("6 unique QR codes, all clearly labelled: " + ", ".join(f"{r['tier_name']} → {r['code']}" for r in rows))

        print("\n[2] Real scanner flow: first scan accepted, second declined", flush=True)
        for r in rows:
            first = (await c.post("/api/scan/checkin", json={"code": r["code"]})).json()
            assert first["result"] == "valid" and first["test"] is True, first
            assert first["admission"] == {"wristband": r["wristband"], "gift": r["gift"]}, first
            second = (await c.post("/api/scan/checkin", json={"code": r["code"]})).json()
            assert second["result"] == "used" and second["reason"] == "ALREADY USED", second
            assert second["ticket"]["checked_in_at"], second
            ok(f"{r['tier_name']}: {r['wristband'].upper()} wristband, gift={r['gift']} → second scan ALREADY USED")
        look = (await c.post("/api/scan/lookup", json={"code": codes[0]})).json()
        assert look["result"] == "used" and look["test"] is True

        print("\n[3] Test data touches nothing real", flush=True)
        assert await db.tickets.count_documents({"code": {"$in": codes}}) == 0, "a test QR must never be a real ticket"
        assert await db.orders.count_documents({"tier_name": {"$regex": "^TEST"}}) == 0, "test tickets must create no order"
        rep = (await c.get("/api/admin/checkin-report")).json()
        assert not [s for s in rep["scans"] if s["code"] in codes], "test scans must not appear in the check-in report"
        assert not [t for t in rep["by_tier"] if t["tier_name"].startswith("TEST")], rep["by_tier"]
        stats = (await c.get("/api/admin/stats")).json()
        assert not [g for g in stats["guest_tickets"] if g["code"] in codes]
        assert not [s for s in stats["recent_scans"] if s["code"] in codes]
        sales = (await c.get("/api/admin/sales-overview")).json()
        assert all(r["revenue"] > 0 for r in sales["rows"]), "test tickets add no 0 Kč sales rows"
        ok("test QRs and their scans appear in no ticket, order, revenue row, check-in report or stat")

        print("\n[4] Delete test data only", flush=True)
        real_before = await db.tickets.count_documents({})
        d = (await c.delete("/api/admin/test-tickets")).json()
        assert d["deleted"] == 6, d
        assert (await c.get("/api/admin/test-tickets")).json() == []
        assert (await c.post("/api/scan/checkin", json={"code": codes[0]})).json()["reason"] == "INVALID"
        assert await db.tickets.count_documents({}) == real_before, "real tickets must survive Delete Test Data"
        ok("Delete Test Data removed only the 6 test tickets — real tickets and stats untouched")

    print("\nTEST MODE PASS", flush=True)


def test_test_mode():
    asyncio.run(main())


if __name__ == "__main__":
    asyncio.run(main())
