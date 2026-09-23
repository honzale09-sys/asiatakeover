"""Regression tests: per-ambassador custom discount amount (CZK)."""
import os
import uuid
import pytest
import requests
from dotenv import dotenv_values

_ENV = {**dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env")), **os.environ}

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": _ENV["ADMIN_EMAIL"], "password": _ENV["ADMIN_PASSWORD"]}


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def ga_tier():
    r = requests.get(f"{BASE_URL}/api/site", timeout=15)
    assert r.status_code == 200, r.text
    tiers = [t for t in r.json()["tiers"]
             if all(k not in t["name"].upper() for k in ("VIP", "GROUP", "GOLD"))]
    tiers.sort(key=lambda t: t["price_czk"])
    active = next(t for t in tiers if (t.get("sold") or 0) < t["capacity"])
    return active


@pytest.fixture(scope="module")
def amb200(admin):
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors", json={
        "name": "TEST Disc200", "instagram": "", "email": f"test_d200_{uuid.uuid4().hex[:6]}@example.com",
        "discount_czk": 200}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def amb_default(admin):
    r = admin.post(f"{BASE_URL}/api/admin/ambassadors", json={
        "name": "TEST DiscDefault", "instagram": "", "email": f"test_dd_{uuid.uuid4().hex[:6]}@example.com"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_create_with_custom_discount(amb200):
    assert amb200["discount_czk"] == 200


def test_create_without_discount_defaults_50(amb_default):
    assert amb_default["discount_czk"] == 50


def test_validate_returns_custom_amount(amb200):
    r = requests.get(f"{BASE_URL}/api/promo/validate?code={amb200['code']}", timeout=15)
    assert r.status_code == 200 and r.json()["valid"] is True
    assert r.json()["amount_off_czk"] == 200


def test_validate_returns_default_50(amb_default):
    r = requests.get(f"{BASE_URL}/api/promo/validate?code={amb_default['code']}", timeout=15)
    assert r.json()["amount_off_czk"] == 50


def test_checkout_deducts_custom_amount(amb200, ga_tier):
    r = requests.post(f"{BASE_URL}/api/orders/create", json={
        "tier_id": ga_tier["id"], "quantity": 1, "name": "TEST Bot",
        "email": f"test_{uuid.uuid4().hex[:8]}@example.com", "phone": "+420000000000",
        "promo_code": amb200["code"]}, timeout=30)
    if r.status_code == 429:
        pytest.skip("rate-limited — rerun after the window resets")
    assert r.status_code == 200, r.text
    assert r.json()["amount_czk"] == ga_tier["price_czk"] - 200


def test_edit_discount_amount(admin, amb200):
    r = admin.put(f"{BASE_URL}/api/admin/ambassadors/{amb200['id']}", json={"discount_czk": 100}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["discount_czk"] == 100
    v = requests.get(f"{BASE_URL}/api/promo/validate?code={amb200['code']}", timeout=15)
    assert v.json()["amount_off_czk"] == 100
    # invalid values rejected
    bad = admin.put(f"{BASE_URL}/api/admin/ambassadors/{amb200['id']}", json={"discount_czk": 0}, timeout=15)
    assert bad.status_code == 422


def test_cleanup_deactivate(admin, amb200, amb_default):
    for a in (amb200, amb_default):
        admin.put(f"{BASE_URL}/api/admin/ambassadors/{a['id']}", json={"active": False}, timeout=15)
