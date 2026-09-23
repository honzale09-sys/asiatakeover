"""E2E tests: Standard→VIP ticket upgrade (sim payment), reservation notes/floor, gold->Messages."""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@asiatakeover.eu", "password": "Takeover2026!"}
GOLD_TIER = "goldtest111111111111111111111111"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def std_ticket(admin):
    orders = admin.get(f"{BASE_URL}/api/admin/orders?include_unpaid=1", timeout=20).json()
    for o in orders:
        for t in o.get("tickets", []):
            tn = (t.get("tier_name") or "").upper()
            if t.get("status") == "valid" and "VIP" not in tn and "GOLD" not in tn:
                return t["code"]
    pytest.skip("no valid standard ticket in preview")


def test_upgrade_check_invalid_code():
    r = requests.post(f"{BASE_URL}/api/upgrade/check", json={"code": "ATF-XXXXXX"}, timeout=15)
    assert r.status_code == 404


def test_upgrade_check_valid(std_ticket):
    r = requests.post(f"{BASE_URL}/api/upgrade/check", json={"code": std_ticket}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["valid"] is True and r.json()["price_czk"] == 400


def test_upgrade_full_flow_sim(std_ticket, admin):
    r = requests.post(f"{BASE_URL}/api/upgrade/create", json={
        "code": std_ticket, "name": "TEST Upgrade Bot",
        "email": f"test_upg_{uuid.uuid4().hex[:6]}@example.com", "phone": "+420000000000"}, timeout=30)
    if r.status_code == 429:
        pytest.skip("rate-limited — rerun after the window resets")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amount_czk"] == 400
    if body["mode"] != "simulation":
        pytest.skip("preview not in simulation mode — cannot complete payment here")
    oid = body["order_id"]
    pay = requests.post(f"{BASE_URL}/api/payments/sim/action", json={"order_id": oid, "action": "paid"}, timeout=20)
    assert pay.status_code == 200 and pay.json()["payment_status"] == "paid", pay.text
    # ticket re-labelled to VIP with the SAME code
    tk = admin.get(f"{BASE_URL}/api/orders/{oid}/tickets", timeout=15).json()["tickets"]
    assert len(tk) == 1 and tk[0]["code"] == std_ticket and tk[0]["tier_name"] == "VIP Table Ticket"
    assert tk[0].get("upgraded") is True
    # second upgrade attempt rejected
    again = requests.post(f"{BASE_URL}/api/upgrade/check", json={"code": std_ticket}, timeout=15)
    assert again.status_code == 400
    # order visible with 400 CZK
    st = requests.get(f"{BASE_URL}/api/orders/{oid}/status", timeout=15).json()
    assert st["payment_status"] == "paid" and st["amount_czk"] == 400


def test_gold_fulfilment_creates_message(admin):
    r = requests.post(f"{BASE_URL}/api/orders/create", json={
        "tier_id": GOLD_TIER, "quantity": 4, "name": "TEST Gold Msg",
        "email": f"test_gm_{uuid.uuid4().hex[:6]}@example.com", "phone": "+420777000111"}, timeout=30)
    if r.status_code == 429:
        pytest.skip("rate-limited — rerun after the window resets")
    assert r.status_code == 200, r.text
    if r.json()["mode"] != "simulation":
        pytest.skip("preview not in simulation mode")
    oid = r.json()["order_id"]
    pay = requests.post(f"{BASE_URL}/api/payments/sim/action", json={"order_id": oid, "action": "paid"}, timeout=20)
    assert pay.json()["payment_status"] == "paid"
    msgs = admin.get(f"{BASE_URL}/api/admin/messages", timeout=15).json()
    gold_msgs = [m for m in msgs if m.get("topic") == "VIP GOLD TABLE" and m.get("order_id") == oid]
    assert len(gold_msgs) == 1
    m = gold_msgs[0]
    assert m["guests"] == 4 and m["name"] == "TEST Gold Msg" and m["phone"] == "+420777000111"
    assert m.get("status", "new") == "new" and not m.get("removed")


def test_message_notes_and_floor(admin):
    msgs = admin.get(f"{BASE_URL}/api/admin/messages", timeout=15).json()
    res = next((m for m in msgs if "guests" in m and not m.get("removed")), None)
    assert res, "no reservation-like message in preview"
    note = f"test note {uuid.uuid4().hex[:6]}"
    r = admin.put(f"{BASE_URL}/api/admin/messages/{res['id']}",
                  json={"notes": note, "floor": "Saigon Floor (5th)"}, timeout=15)
    assert r.status_code == 200, r.text
    msgs2 = admin.get(f"{BASE_URL}/api/admin/messages", timeout=15).json()
    m2 = next(x for x in msgs2 if x["id"] == res["id"])
    assert m2["notes"] == note and m2["floor"] == "Saigon Floor (5th)"
    bad = admin.put(f"{BASE_URL}/api/admin/messages/{res['id']}", json={"floor": "Mars Floor"}, timeout=15)
    assert bad.status_code == 400
