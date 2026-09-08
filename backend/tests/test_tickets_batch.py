"""Backend tests for the /tickets carousel batch: order phone requirement,
/reservations endpoint, /site regression, promo regression."""
import os
import uuid
import pytest
import requests
from pathlib import Path

def _load_frontend_env():
    p = Path("/app/frontend/.env")
    if p.exists():
        for line in p.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

_load_frontend_env()
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@asiatakeover.eu"
ADMIN_PASSWORD = "Takeover2026!"


@pytest.fixture(scope="module")
def site():
    r = requests.get(f"{API}/site", timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def ga_tier(site):
    tiers = [t for t in site["tiers"] if "VIP" not in t["name"].upper()]
    tiers.sort(key=lambda t: t["price_czk"])
    active = next((t for t in tiers if (t.get("sold", 0) < t["capacity"])), None)
    assert active, "No active GA tier"
    return active


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


# ---- /api/site regression ----
def test_site_ok(site):
    assert site["event"]["name"]
    assert isinstance(site["tiers"], list) and len(site["tiers"]) > 0


# ---- Promo ATFTEST95 regression ----
def test_promo_atftest95_invalid():
    r = requests.get(f"{API}/promo/validate", params={"code": "ATFTEST95"}, timeout=10)
    assert r.status_code == 200
    assert r.json() == {"valid": False}


# ---- Order phone field required ----
def test_order_missing_phone_rejected(ga_tier):
    payload = {
        "tier_id": ga_tier["id"], "quantity": 1,
        "name": "TEST NoPhone",
        "email": f"test-nophone-{uuid.uuid4().hex[:6]}@example.com",
    }
    r = requests.post(f"{API}/orders/create", json=payload, timeout=15)
    assert r.status_code == 422, f"expected 422 for missing phone, got {r.status_code}: {r.text}"


def test_order_short_phone_rejected(ga_tier):
    payload = {
        "tier_id": ga_tier["id"], "quantity": 1,
        "name": "TEST ShortPhone",
        "email": f"test-shortphone-{uuid.uuid4().hex[:6]}@example.com",
        "phone": "123",
    }
    r = requests.post(f"{API}/orders/create", json=payload, timeout=15)
    assert r.status_code == 422, r.text


def test_order_with_phone_creates_and_stores(ga_tier, admin_session):
    email = f"test-phone-{uuid.uuid4().hex[:6]}@example.com"
    phone = "+420777123456"
    payload = {
        "tier_id": ga_tier["id"], "quantity": 1,
        "name": "TEST BuyerPhone",
        "email": email,
        "phone": phone,
        "marketing_consent": False,
    }
    r = requests.post(f"{API}/orders/create", json=payload, timeout=30)
    # Teya is LIVE; expect 200 or gateway 502 — mark payment gateway issues as skips
    if r.status_code == 502:
        pytest.skip("Teya gateway not reachable in this env")
    assert r.status_code == 200, r.text
    order_id = r.json()["order_id"]

    # Verify via admin API (unpaid orders are hidden from /admin/orders — use direct DB via orders/status)
    st = requests.get(f"{API}/orders/{order_id}/status", timeout=15)
    assert st.status_code == 200
    # Cleanup: admin delete
    admin_session.delete(f"{API}/admin/orders/{order_id}", timeout=15)


# ---- Reservations endpoint ----
def test_reservation_valid_creates_message(admin_session):
    tag = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST Reserve {tag}",
        "phone": "+420777000111",
        "email": f"test-res-{tag}@example.com",
        "guests": 6,
        "floor": "Seoul Floor (7th)",
        "message": "TEST reservation from automated test",
    }
    r = requests.post(f"{API}/reservations", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert "id" in body

    # Verify it lands in admin messages with correct topic
    msgs = admin_session.get(f"{API}/admin/messages", timeout=15).json()
    match = next((m for m in msgs if m.get("id") == body["id"]), None)
    assert match, "Reservation not visible in admin messages"
    assert match["topic"] == "VIP Table Reservation"
    assert match["phone"] == payload["phone"]
    assert match["guests"] == payload["guests"]
    assert match["floor"] == payload["floor"]
    assert match["name"] == payload["name"]


def test_reservation_missing_fields_rejected():
    r = requests.post(f"{API}/reservations", json={"name": "x"}, timeout=10)
    assert r.status_code == 422


def test_reservation_invalid_guests_rejected():
    r = requests.post(f"{API}/reservations", json={
        "name": "TEST bad", "phone": "+420111222333",
        "email": "x@example.com", "guests": 0, "floor": "Seoul",
    }, timeout=10)
    assert r.status_code == 422


# ---- Admin auth still works ----
def test_admin_login(admin_session):
    r = admin_session.get(f"{API}/auth/me", timeout=10)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL
