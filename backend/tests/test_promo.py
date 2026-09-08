"""Tests for promo code feature (MZYPL5BKOD — active 95% test code)."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
GA_TIER_ID = "7425d4a5cf0349e39ca3c37bacefaaf7"
GA_LIST_PRICE = 499
PROMO = "MZYPL5BKOD"


@pytest.fixture(scope="module")
def site():
    r = requests.get(f"{BASE_URL}/api/site", timeout=15)
    assert r.status_code == 200
    return r.json()


def test_site_ok(site):
    assert isinstance(site, dict)


def test_promo_validate_upper():
    r = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": PROMO}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert data["percent_off"] == 95


def test_promo_validate_lower():
    r = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": PROMO.lower()}, timeout=10)
    assert r.status_code == 200
    assert r.json()["valid"] is True
    assert r.json()["percent_off"] == 95


def test_promo_validate_unknown():
    r = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": "FAKECODE"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("valid") is False


def test_old_test_code_stays_disabled():
    r = requests.get(f"{BASE_URL}/api/promo/validate", params={"code": "ATFTEST95"}, timeout=10)
    assert r.status_code == 200
    assert r.json().get("valid") is False


def _order_payload(qty=1, promo=None):
    p = {
        "tier_id": GA_TIER_ID,
        "quantity": qty,
        "name": "TEST Buyer",
        "email": "test_promo@example.com",
        "phone": "+420000000000",
    }
    if promo is not None:
        p["promo_code"] = promo
    return p


def test_create_order_with_promo_qty1():
    r = requests.post(f"{BASE_URL}/api/orders/create", json=_order_payload(1, PROMO), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("amount_czk") == 25
    assert data.get("mode") == "teya"
    assert data.get("session_token")


def test_create_order_with_promo_qty2():
    r = requests.post(f"{BASE_URL}/api/orders/create", json=_order_payload(2, PROMO), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("amount_czk") == 50


def test_create_order_invalid_promo():
    r = requests.post(f"{BASE_URL}/api/orders/create", json=_order_payload(1, "FAKECODE"), timeout=20)
    assert r.status_code == 400
    assert "Invalid discount code" in r.text


def test_create_order_without_promo_regression():
    r = requests.post(f"{BASE_URL}/api/orders/create", json=_order_payload(1, None), timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("amount_czk") == GA_LIST_PRICE
    assert data.get("mode") == "teya"
