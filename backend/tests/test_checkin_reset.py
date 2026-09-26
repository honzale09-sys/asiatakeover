"""Regression tests: admin reset-checkin endpoint + tickets_sold counts all QR tickets."""
import os
import pytest
import requests
from dotenv import dotenv_values

_ENV = {**dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env")), **os.environ}

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": _ENV["ADMIN_EMAIL"], "password": _ENV["ADMIN_PASSWORD"]}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return s


def test_reset_requires_auth():
    r = requests.post(f"{BASE_URL}/api/admin/tickets/ATF-XXXXXX/reset-checkin", timeout=10)
    assert r.status_code in (401, 403)


def test_tickets_sold_counts_all_incl_guest_list(admin):
    s = admin.get(f"{BASE_URL}/api/admin/stats", timeout=15).json()
    # guest list tickets are included in tickets_sold now
    assert s["tickets_sold"] >= s["categories"]["vip_guest_list"]["sent"]
    assert s["tickets_sold"] >= s["categories"]["standard"]["sold"] + s["categories"]["vip"]["sold"]


def test_reset_used_ticket_flow(admin):
    """Uses its own throwaway comp ticket — real orders, tickets and check-ins are never touched."""
    r = admin.post(f"{BASE_URL}/api/admin/comp-tickets",
                   json={"quantity": 1, "holder_name": "Reset Regression", "category": "standard"}, timeout=20)
    assert r.status_code == 200, r.text
    comp = r.json()
    code = comp["tickets"][0]["code"]
    try:
        scan = admin.post(f"{BASE_URL}/api/scan/checkin", json={"code": code}, timeout=15).json()
        assert scan["result"] == "valid", scan
        r = admin.post(f"{BASE_URL}/api/admin/tickets/{code}/reset-checkin", timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "valid"
        # second reset rejected — no longer checked in
        r2 = admin.post(f"{BASE_URL}/api/admin/tickets/{code}/reset-checkin", timeout=15)
        assert r2.status_code == 400
        # unknown ticket 404
        r3 = admin.post(f"{BASE_URL}/api/admin/tickets/ATF-FFFFFF/reset-checkin", timeout=15)
        assert r3.status_code == 404
    finally:
        assert admin.delete(f"{BASE_URL}/api/admin/orders/{comp['order_id']}", timeout=20).status_code == 200
