"""Backend API sanity checks after code-review Part B refactor.
Tests public + admin endpoints exposed via preview URL through Kubernetes ingress.
WAF blocks non-browser UAs on /api/scan/* so we set a browser UA.
"""
import os
import requests
import pytest

def _load_base():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    # fallback: read from frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE = _load_base()
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
HDR = {"User-Agent": UA, "Content-Type": "application/json"}
from dotenv import dotenv_values

_ENV = {**dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env")), **os.environ}
ADMIN_EMAIL = _ENV["ADMIN_EMAIL"]
ADMIN_PASS = _ENV["ADMIN_PASSWORD"]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_session(s):
    r = s.post(f"{BASE}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
               headers=HDR, timeout=15)
    assert r.status_code == 200, r.text
    return s


# ---------- public /api/site ----------
def test_site_public(s):
    r = s.get(f"{BASE}/api/site", headers=HDR, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "tiers" in data and isinstance(data["tiers"], list) and len(data["tiers"]) > 0


# ---------- upgrade check ----------
def test_upgrade_check_valid(s):
    r = s.post(f"{BASE}/api/upgrade/check",
               json={"code": "ATF-63BBC9"}, headers=HDR, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d.get("price_czk") == 400


def test_upgrade_check_unknown(s):
    r = s.post(f"{BASE}/api/upgrade/check",
               json={"code": "nope"}, headers=HDR, timeout=15)
    assert r.status_code == 404


# ---------- orders/create validation paths ----------
def test_create_order_invalid_promo(s):
    payload = {
        "name": "TEST_qa",
        "email": "TEST_qa@example.com",
        "phone": "+420777000111",
        "quantity": 1,
        "tier_id": "7425d4a5cf0349e39ca3c37bacefaaf7",  # 1ST RELEASE
        "promo_code": "TOTALLY-NOT-A-CODE-XYZ",
    }
    r = s.post(f"{BASE}/api/orders/create", json=payload, headers=HDR, timeout=15)
    assert r.status_code == 400, r.text
    assert "invalid discount" in r.text.lower() or "invalid promo" in r.text.lower() or "discount code" in r.text.lower()


def test_create_order_gold_with_promo(s):
    payload = {
        "name": "TEST_qa",
        "email": "TEST_qa@example.com",
        "phone": "+420777000111",
        "quantity": 4,
        "tier_id": "goldtest111111111111111111111111",  # VIP GOLD TABLE
        "promo_code": "MZYPL5BKOD",
    }
    r = s.post(f"{BASE}/api/orders/create", json=payload, headers=HDR, timeout=15)
    assert r.status_code == 400, r.text
    body = r.text.lower()
    assert "gold" in body


# ---------- reservations floor validation ----------
def test_reservations_invalid_floor(s):
    payload = {
        "name": "TEST_qa",
        "email": "TEST_qa@example.com",
        "phone": "+420777000111",
        "guests": 4,
        "floor": "Mainstream Floor (6th)",
    }
    r = s.post(f"{BASE}/api/reservations", json=payload, headers=HDR, timeout=15)
    # Endpoint may name differently, accept 400 explicitly
    assert r.status_code == 400, r.text


# ---------- admin stats ----------
def test_admin_stats(admin_session):
    r = admin_session.get(f"{BASE}/api/admin/stats", headers={"User-Agent": UA}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("revenue_czk", "tickets_sold", "categories", "revenue_check", "ambassadors", "per_tier"):
        assert k in d, f"missing key {k}: keys={list(d.keys())}"
    cats = d["categories"]
    for c in ("standard", "vip", "vip_guest_list"):
        assert c in cats, f"missing category {c}"


# ---------- admin message floor validation ----------
def test_admin_messages_invalid_floor(admin_session):
    r = admin_session.get(f"{BASE}/api/admin/messages", headers={"User-Agent": UA}, timeout=15)
    assert r.status_code == 200
    msgs = r.json()
    if not isinstance(msgs, list) or not msgs:
        pytest.skip("no messages available")
    mid = msgs[0].get("id") or msgs[0].get("_id")
    assert mid
    r = admin_session.put(
        f"{BASE}/api/admin/messages/{mid}",
        json={"floor": "Mainstream Floor (6th)"},
        headers=HDR, timeout=15,
    )
    assert r.status_code == 400, r.text
    assert "floor" in r.text.lower()
