"""
Test the DOORSTAFF door-role session:
- login case-insensitivity
- door session is BLOCKED from /api/admin/*  (expect 403)
- door session CAN use /api/auth/me, /api/scan/lookup, /api/scan/checkin
- Admin still works (all key endpoints + login unchanged)
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"}

DOOR_USER = "DOORSTAFF"
DOOR_PASS = "NinjaSapafood123!"
ADMIN_USER = "admin@asiatakeover.eu"
ADMIN_PASS = "Takeover2026!"

ADMIN_ENDPOINTS = [
    "/api/admin/stats",
    "/api/admin/orders",
    "/api/admin/test-tickets",
    "/api/admin/promo-codes",
    "/api/admin/checkin-report",
    "/api/admin/sales-overview",
]


def _login(identifier, password):
    s = requests.Session()
    s.headers.update(UA)
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": identifier, "password": password}, timeout=15)
    return s, r


# --- Door staff login (case-insensitive) ---

def test_door_login_uppercase():
    s, r = _login(DOOR_USER, DOOR_PASS)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("role") == "door", data


def test_door_login_lowercase():
    s, r = _login(DOOR_USER.lower(), DOOR_PASS)
    assert r.status_code == 200, r.text
    assert r.json().get("role") == "door"


def test_door_login_wrong_password():
    s, r = _login(DOOR_USER, "wrong-pass-xyz")
    assert r.status_code in (401, 403), r.text


# --- Door staff CANNOT reach /api/admin/* ---

@pytest.fixture(scope="module")
def door_session():
    s, r = _login(DOOR_USER, DOOR_PASS)
    assert r.status_code == 200
    return s


@pytest.mark.parametrize("path", ADMIN_ENDPOINTS)
def test_door_forbidden_admin(door_session, path):
    r = door_session.get(f"{BASE_URL}{path}", timeout=15)
    assert r.status_code == 403, f"{path} expected 403, got {r.status_code}: {r.text[:200]}"


# --- Door staff CAN reach staff endpoints ---

def test_door_can_auth_me(door_session):
    r = door_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 200
    assert r.json().get("role") == "door"


def test_door_can_scan_lookup_invalid(door_session):
    r = door_session.post(f"{BASE_URL}/api/scan/lookup", json={"code": "ATF-NOPE00"}, timeout=15)
    # lookup endpoint should be reachable (200/404 both fine — NOT 403)
    assert r.status_code in (200, 400, 404), r.text


def test_door_can_scan_checkin_invalid(door_session):
    r = door_session.post(f"{BASE_URL}/api/scan/checkin", json={"code": "ATF-NOPE00"}, timeout=15)
    assert r.status_code in (200, 400, 404), r.text
    # If 200, body should carry a decline reason (not authorized to skip)
    if r.status_code == 200:
        body = r.json()
        assert body.get("result") in ("declined", "invalid", "used") or body.get("valid") is False


def test_door_can_refresh(door_session):
    r = door_session.post(f"{BASE_URL}/api/auth/refresh", timeout=15)
    assert r.status_code in (200, 204), r.text


# --- Admin still works ---

@pytest.fixture(scope="module")
def admin_session():
    s, r = _login(ADMIN_USER, ADMIN_PASS)
    assert r.status_code == 200, r.text
    return s


def test_admin_stats_ok(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/admin/stats", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ("revenue_czk", "tickets_sold", "checked_in", "orders"):
        assert k in data, f"missing {k} in stats"


def test_admin_can_reach_all_admin_endpoints(admin_session):
    for p in ADMIN_ENDPOINTS:
        r = admin_session.get(f"{BASE_URL}{p}", timeout=15)
        assert r.status_code == 200, f"{p} got {r.status_code}"
