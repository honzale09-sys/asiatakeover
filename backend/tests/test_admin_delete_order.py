"""Tests for admin delete-order endpoint and related content changes."""
import os
import requests
from dotenv import dotenv_values

_ENV = {**dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env")), **os.environ}
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = _ENV["ADMIN_EMAIL"]
ADMIN_PASSWORD = _ENV["ADMIN_PASSWORD"]
GA_TIER_ID = "7425d4a5cf0349e39ca3c37bacefaaf7"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
               timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


# --- auth guard ---
def test_delete_unauthenticated_forbidden():
    r = requests.delete(f"{BASE_URL}/api/admin/orders/does-not-exist", timeout=10)
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


def test_get_admin_orders_unauthenticated_forbidden():
    r = requests.get(f"{BASE_URL}/api/admin/orders", timeout=10)
    assert r.status_code in (401, 403)


# --- delete flow: create order (unpaid teya session is fine), delete, verify gone ---
def test_admin_delete_order_full_flow(admin_session):
    # Create a fresh test order via public endpoint (unpaid — hidden from admin list by design)
    payload = {
        "tier_id": GA_TIER_ID,
        "quantity": 1,
        "name": "TEST Delete Buyer",
        "email": "test_delete@example.com",
        "phone": "+420000000000",
        "promo_code": "MZYPL5BKOD",
    }
    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    order_id = data.get("order_id") or data.get("id")
    assert order_id, f"could not resolve order_id from response {data}"

    # Unpaid orders are intentionally hidden from the admin list
    orders = admin_session.get(f"{BASE_URL}/api/admin/orders", timeout=15).json()
    assert not any(o["id"] == order_id for o in orders), "unpaid order should be hidden from admin list"

    # Delete
    dr = admin_session.delete(f"{BASE_URL}/api/admin/orders/{order_id}", timeout=15)
    assert dr.status_code == 200, dr.text
    body = dr.json()
    assert body.get("ok") is True

    # Second delete → 404
    dr2 = admin_session.delete(f"{BASE_URL}/api/admin/orders/{order_id}", timeout=10)
    assert dr2.status_code == 404


# --- content regression via /api/site (email template lives in server code, check others) ---
def test_site_endpoint_ok():
    r = requests.get(f"{BASE_URL}/api/site", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
