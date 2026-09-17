"""Regression tests: admin Messages status / remove / restore workflow."""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@asiatakeover.eu", "password": "Takeover2026!"}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def reservation():
    p = {"name": "TEST Msg Bot", "phone": "+420000000000",
         "email": f"test_msg_{uuid.uuid4().hex[:8]}@example.com",
         "guests": 6, "floor": "Seoul Floor (7th)", "message": "test reservation"}
    r = requests.post(f"{BASE_URL}/api/reservations", json=p, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_reservation_has_default_status(admin, reservation):
    msgs = admin.get(f"{BASE_URL}/api/admin/messages", timeout=15).json()
    m = next(x for x in msgs if x["id"] == reservation)
    assert m.get("status", "new") == "new"
    assert not m.get("removed")


def test_status_update_and_validation(admin, reservation):
    r = admin.put(f"{BASE_URL}/api/admin/messages/{reservation}", json={"status": "confirmed"}, timeout=15)
    assert r.status_code == 200, r.text
    msgs = admin.get(f"{BASE_URL}/api/admin/messages", timeout=15).json()
    assert next(x for x in msgs if x["id"] == reservation)["status"] == "confirmed"
    bad = admin.put(f"{BASE_URL}/api/admin/messages/{reservation}", json={"status": "bogus"}, timeout=15)
    assert bad.status_code == 400


def test_status_endpoints_require_auth(reservation):
    assert requests.put(f"{BASE_URL}/api/admin/messages/{reservation}", json={"status": "new"}, timeout=10).status_code in (401, 403)
    assert requests.post(f"{BASE_URL}/api/admin/messages/{reservation}/remove", timeout=10).status_code in (401, 403)
    assert requests.post(f"{BASE_URL}/api/admin/messages/{reservation}/restore", timeout=10).status_code in (401, 403)


def test_remove_and_restore(admin, reservation):
    r = admin.post(f"{BASE_URL}/api/admin/messages/{reservation}/remove", timeout=15)
    assert r.status_code == 200, r.text
    msgs = admin.get(f"{BASE_URL}/api/admin/messages", timeout=15).json()
    assert next(x for x in msgs if x["id"] == reservation)["removed"] is True
    r = admin.post(f"{BASE_URL}/api/admin/messages/{reservation}/restore", timeout=15)
    assert r.status_code == 200, r.text
    msgs = admin.get(f"{BASE_URL}/api/admin/messages", timeout=15).json()
    m = next(x for x in msgs if x["id"] == reservation)
    assert m["removed"] is False
    assert m["status"] == "confirmed"  # status survives remove/restore


def test_missing_message_404(admin):
    assert admin.put(f"{BASE_URL}/api/admin/messages/nope123", json={"status": "new"}, timeout=10).status_code == 404
    assert admin.post(f"{BASE_URL}/api/admin/messages/nope123/remove", timeout=10).status_code == 404
