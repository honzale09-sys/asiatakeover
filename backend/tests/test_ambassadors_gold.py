"""Regression tests: VIP GOLD TABLE pricing/capacity + Ambassador program logic.
Runs against the preview deployment (REACT_APP_BACKEND_URL)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@asiatakeover.eu", "password": "Takeover2026!"}
GOLD_TIER = "goldtest111111111111111111111111"
GA_TIER = "7425d4a5cf0349e39ca3c37bacefaaf7"
VIP_TIER = "f2deb317d7a44e7c9a4e761511be6776"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return s


def _order(tier_id, qty, promo=None, email=None):
    p = {"tier_id": tier_id, "quantity": qty, "name": "TEST Bot",
         "email": email or f"test_{uuid.uuid4().hex[:8]}@example.com", "phone": "+420000000000"}
    if promo:
        p["promo_code"] = promo
    return requests.post(f"{BASE_URL}/api/orders/create", json=p, timeout=30)


def _order_or_skip(*args, **kwargs):
    """orders/create is IP-rate-limited (10/5min) by design; skip gracefully on 429."""
    r = _order(*args, **kwargs)
    if r.status_code == 429:
        pytest.skip("rate-limited (10 orders/5min per IP) — rerun after the window resets")
    return r


# ---------- GOLD TABLE ----------

def test_gold_price_4_guests():
    r = _order_or_skip(GOLD_TIER, 4)
    assert r.status_code == 200, r.text
    assert r.json()["amount_czk"] == 7595


def test_gold_price_6_guests():
    assert _order_or_skip(GOLD_TIER, 6).json()["amount_czk"] == 9393


def test_gold_price_7_guests():
    assert _order_or_skip(GOLD_TIER, 7).json()["amount_czk"] == 10292


def test_gold_price_8_guests():
    assert _order_or_skip(GOLD_TIER, 8).json()["amount_czk"] == 11191


def test_gold_price_9_guests():
    assert _order_or_skip(GOLD_TIER, 9).json()["amount_czk"] == 12090


def test_gold_price_10_guests():
    assert _order_or_skip(GOLD_TIER, 10).json()["amount_czk"] == 12989


def test_gold_price_14_guests():
    assert _order_or_skip(GOLD_TIER, 14).json()["amount_czk"] == 16585


def test_gold_below_4_rejected():
    assert _order(GOLD_TIER, 3).status_code == 400


def test_gold_above_14_rejected():
    assert _order(GOLD_TIER, 15).status_code in (400, 422)  # 422 = pydantic max-quantity guard


def test_gold_promo_rejected():
    r = _order(GOLD_TIER, 4, promo="MZYPL5BKOD")
    assert r.status_code == 400


def test_gold_tier_sold_counts_tables(admin):
    r = admin.get(f"{BASE_URL}/api/site", timeout=15)
    gold = next(t for t in r.json()["tiers"] if "GOLD" in t["name"].upper())
    # no paid gold orders in preview -> 0 tables sold, capacity 3 (raised 2→3 by owner)
    assert gold["sold"] == 0
    assert gold["capacity"] == 3


# ---------- RESERVATIONS ----------

def test_reservation_mainstream_rejected():
    r = requests.post(f"{BASE_URL}/api/reservations", json={
        "name": "T", "phone": "+420000000", "email": "t@t.cz", "guests": 4,
        "floor": "Mainstream Floor (6th)", "message": ""}, timeout=15)
    assert r.status_code == 400


def test_reservation_seoul_ok():
    r = requests.post(f"{BASE_URL}/api/reservations", json={
        "name": "T", "phone": "+420000000", "email": "t@t.cz", "guests": 4,
        "floor": "Seoul Floor (7th)", "message": ""}, timeout=15)
    assert r.status_code == 200


# ---------- AMBASSADORS ----------

@pytest.fixture(scope="module")
def ambassador(admin):
    code = "T" + uuid.uuid4().hex[:6].upper()
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors",
                   json={"name": "Test Amb", "instagram": "@testamb", "email": "amb@example.com", "code": code},
                   timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["referral_url"].endswith(f"/tickets?ref={code}")
    return data


def test_ambassador_validate_50czk(ambassador):
    r = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": ambassador["code"]}, timeout=10)
    d = r.json()
    assert d["valid"] is True
    assert d["amount_off_czk"] == 50
    assert d["uses_left"] == 10


def test_ambassador_50czk_applied(ambassador):
    r = _order_or_skip(GA_TIER, 1, promo=ambassador["code"])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["amount_czk"] == 499 - 50  # 449


def test_ambassador_code_rejected_on_group(ambassador):
    r = _order_or_skip("grp4test1111111111111111111111", 1, promo=ambassador["code"])
    assert r.status_code == 400


def test_ambassador_code_rejected_on_gold(ambassador):
    r = _order_or_skip(GOLD_TIER, 4, promo=ambassador["code"])
    assert r.status_code == 400


def test_ambassador_qr_png(admin, ambassador):
    r = admin.get(f"{BASE_URL}/api/admin/ambassadors/{ambassador['id']}/qr.png", timeout=15)
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert len(r.content) > 300


def test_ambassador_stories_counter(admin, ambassador):
    aid = ambassador["id"]
    for _ in range(8):
        r = admin.post(f"{BASE_URL}/api/admin/ambassadors/{aid}/stories", json={"delta": 1}, timeout=10)
        assert r.status_code == 200
    assert r.json()["stories_shared"] == 8
    # cannot go above 8
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors/{aid}/stories", json={"delta": 1}, timeout=10)
    assert r.json()["stories_shared"] == 8


def test_fifty_code_created_at_8_stories(admin, ambassador):
    aid = ambassador["id"]
    for _ in range(8):
        admin.post(f"{BASE_URL}/api/admin/ambassadors/{aid}/stories", json={"delta": 1}, timeout=10)
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors/{aid}/fifty-code", timeout=10)
    if r.status_code == 400:
        # already created by a previous test run — verify it exists and move on
        amb = next(a for a in admin.get(f"{BASE_URL}/api/admin/ambassadors", timeout=15).json() if a["id"] == aid)
        assert amb["fifty"]["code"].startswith("ATF50-")
        return
    assert r.status_code == 200, r.text
    fifty = r.json()["fifty"]
    assert fifty["code"].startswith("ATF50-")
    assert fifty["redeemed"] is False
    # validate works: 50% off, max 1
    v = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": fifty["code"]}, timeout=10).json()
    assert v["valid"] is True and v["percent_off"] == 50 and v["max_qty"] == 1
    # second code creation rejected
    r2 = admin.post(f"{BASE_URL}/api/admin/ambassadors/{aid}/fifty-code", timeout=10)
    assert r2.status_code == 400


def test_fifty_code_one_ticket_only(admin, ambassador):
    aid = ambassador["id"]
    for _ in range(8):
        admin.post(f"{BASE_URL}/api/admin/ambassadors/{aid}/stories", json={"delta": 1}, timeout=10)
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors/{aid}/fifty-code", timeout=10)
    assert r.status_code in (200, 400), r.text  # 400 = code already created by a previous run
    amb = next(a for a in admin.get(f"{BASE_URL}/api/admin/ambassadors", timeout=15).json() if a["id"] == aid)
    code = amb["fifty"]["code"]
    r = _order_or_skip(GA_TIER, 2, promo=code)
    assert r.status_code == 400
    r = _order_or_skip(GA_TIER, 1, promo=code)
    assert r.status_code == 200
    assert r.json()["amount_czk"] == round(499 / 2)


def test_rewards_not_eligible_below_3_sales(admin, ambassador):
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors/{ambassador['id']}/send-reward", json={"type": "standard"}, timeout=10)
    assert r.status_code == 400


def test_ambassador_deactivate_blocks_code(admin, ambassador):
    aid = ambassador["id"]
    admin.put(f"{BASE_URL}/api/admin/ambassadors/{aid}", json={"active": False}, timeout=10)
    v = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": ambassador["code"]}, timeout=10).json()
    assert v["valid"] is False
    admin.put(f"{BASE_URL}/api/admin/ambassadors/{aid}", json={"active": True}, timeout=10)
    v = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": ambassador["code"]}, timeout=10).json()
    assert v["valid"] is True


def test_ambassador_duplicate_code_rejected(admin, ambassador):
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors",
                   json={"name": "Dup", "email": "dup@example.com", "code": ambassador["code"]}, timeout=10)
    assert r.status_code == 409


def test_stats_include_ambassador_overview(admin):
    d = admin.get(f"{BASE_URL}/api/admin/stats", timeout=15).json()
    assert "ambassadors" in d
    assert d["ambassadors"]["active"] >= 1
