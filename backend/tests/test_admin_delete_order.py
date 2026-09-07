"""Tests for admin delete-order endpoint and related content changes."""
import os
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@asiatakeover.eu"
ADMIN_PASSWORD = "Takeover2026!"
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
    # Create a fresh test order via public endpoint
    payload = {
        "tier_id": GA_TIER_ID,
        "quantity": 1,
        "name": "TEST Delete Buyer",
        "email": "test_delete@example.com",
        "promo_code": "ATFTEST95",
    }
    r = requests.post(f"{BASE_URL}/api/orders/create", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    order_id = data.get("order_id") or data.get("id")
    # order_id might be nested — fall back to searching admin list
    if not order_id:
        orders = admin_session.get(f"{BASE_URL}/api/admin/orders", timeout=15).json()
        # find newest matching TEST_delete
        for o in orders:
            if o.get("email") == "test_delete@example.com":
                order_id = o["id"]
                break
    assert order_id, f"could not resolve order_id from response {data}"

    # Ensure it appears in admin list
    orders = admin_session.get(f"{BASE_URL}/api/admin/orders", timeout=15).json()
    assert any(o["id"] == order_id for o in orders), "created order not in admin list"

    # Snapshot ticket codes (may be empty for unpaid teya but check anyway)
    the_order = next(o for o in orders if o["id"] == order_id)
    ticket_codes = [t["code"] for t in the_order.get("tickets", [])]

    # Delete
    dr = admin_session.delete(f"{BASE_URL}/api/admin/orders/{order_id}", timeout=15)
    assert dr.status_code == 200, dr.text
    body = dr.json()
    assert body.get("ok") is True

    # Verify gone from admin list
    orders2 = admin_session.get(f"{BASE_URL}/api/admin/orders", timeout=15).json()
    assert not any(o["id"] == order_id for o in orders2), "order still present after delete"

    # Verify tickets invalidated via scan/lookup (admin protected)
    for code in ticket_codes:
        r2 = admin_session.post(f"{BASE_URL}/api/scan/lookup", json={"code": code}, timeout=10)
        assert r2.status_code == 200
        assert r2.json().get("result") == "invalid", f"ticket {code} still valid"

    # Second delete → 404
    dr2 = admin_session.delete(f"{BASE_URL}/api/admin/orders/{order_id}", timeout=10)
    assert dr2.status_code == 404


# --- content regression via /api/site (email template lives in server code, check others) ---
def test_site_endpoint_ok():
    r = requests.get(f"{BASE_URL}/api/site", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict)
