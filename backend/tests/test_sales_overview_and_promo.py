"""Tests for new admin endpoints: GET /admin/sales-overview and full /admin/promo-codes CRUD.
Also validates promo checkout behaviour (percent, amount_off_czk, max_uses, inactive)."""
import os
import uuid
import requests
import pytest

def _load_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return os.environ.get("REACT_APP_BACKEND_URL", "")

BASE_URL = _load_env().rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@asiatakeover.eu"
ADMIN_PASS = "Takeover2026!"

# ---------- fixtures ----------

@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="session")
def active_tier():
    return None  # unused (promo/validate is GET code-only)


# ---------- sales-overview ----------

class TestSalesOverview:
    def test_matches_admin_stats(self, admin_session):
        so = admin_session.get(f"{API}/admin/sales-overview", timeout=15)
        assert so.status_code == 200, so.text
        data = so.json()
        assert "today" in data and "rows" in data
        assert isinstance(data["rows"], list)
        # revenue for "All time" + "All tickets" must equal the admin Revenue stat card
        rev = sum(r["revenue"] for r in data["rows"])
        stats = admin_session.get(f"{API}/admin/stats", timeout=15).json()
        assert rev == stats["revenue_czk"], f"revenue mismatch: SO={rev} vs stats={stats['revenue_czk']}"
        # note: tickets may legitimately differ from stats.tickets_sold if paid upgrades exist
        # (SO excludes upgrade quantity to avoid double counting QR codes)

    def test_row_shape(self, admin_session):
        rows = admin_session.get(f"{API}/admin/sales-overview", timeout=15).json()["rows"]
        for r in rows:
            assert set(r.keys()) >= {"date", "category", "tickets", "revenue"}
            assert r["category"] in ("standard", "vip")
            assert r["revenue"] > 0

    def test_requires_admin(self):
        r = requests.get(f"{API}/admin/sales-overview", timeout=15)
        assert r.status_code in (401, 403)


# ---------- promo CRUD ----------

class TestPromoCRUD:
    created = []

    @classmethod
    def teardown_class(cls):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        for c in cls.created:
            try:
                s.delete(f"{API}/admin/promo-codes/{c}", timeout=15)
            except Exception:
                pass

    def _new_code(self, prefix="TEST"):
        return f"{prefix}{uuid.uuid4().hex[:6].upper()}"

    def test_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/promo-codes", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_percent_and_get(self, admin_session):
        code = self._new_code()
        self.created.append(code)
        r = admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 20, "amount_off_czk": None,
            "max_uses": 5, "note": "TEST percent", "active": True,
        }, timeout=15)
        assert r.status_code == 200, r.text
        # verify via list
        items = admin_session.get(f"{API}/admin/promo-codes", timeout=15).json()
        found = [p for p in items if p["code"] == code]
        assert found, "created code not in list"
        assert found[0]["percent_off"] == 20
        assert found[0]["max_uses"] == 5
        assert found[0]["active"] is True

    def test_create_conflict_returns_409(self, admin_session):
        code = self._new_code()
        self.created.append(code)
        r1 = admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 10, "amount_off_czk": None,
            "max_uses": None, "note": "", "active": True,
        }, timeout=15)
        assert r1.status_code == 200
        r2 = admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 10, "amount_off_czk": None,
            "max_uses": None, "note": "", "active": True,
        }, timeout=15)
        assert r2.status_code == 409, r2.text

    def test_create_autogenerates_code_when_blank(self, admin_session):
        r = admin_session.post(f"{API}/admin/promo-codes", json={
            "code": None, "percent_off": 15, "amount_off_czk": None,
            "max_uses": None, "note": "TEST auto", "active": True,
        }, timeout=15)
        assert r.status_code == 200, r.text
        code = r.json().get("code")
        assert code and len(code) >= 4
        self.created.append(code)

    def test_percent_out_of_range_rejected(self, admin_session):
        r = admin_session.post(f"{API}/admin/promo-codes", json={
            "code": self._new_code(), "percent_off": 150, "amount_off_czk": None,
            "max_uses": None, "note": "", "active": True,
        }, timeout=15)
        assert r.status_code in (400, 422)

    def test_edit_and_toggle(self, admin_session):
        code = self._new_code()
        self.created.append(code)
        admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 10, "amount_off_czk": None,
            "max_uses": None, "note": "", "active": True,
        }, timeout=15)
        # switch to fixed amount and change max_uses
        r = admin_session.put(f"{API}/admin/promo-codes/{code}", json={
            "percent_off": None, "amount_off_czk": 100, "max_uses": 3, "note": "TEST edited",
        }, timeout=15)
        assert r.status_code == 200, r.text
        items = {p["code"]: p for p in admin_session.get(f"{API}/admin/promo-codes", timeout=15).json()}
        assert items[code]["amount_off_czk"] == 100
        assert items[code]["percent_off"] in (None, 0)
        assert items[code]["max_uses"] == 3
        # deactivate
        r = admin_session.put(f"{API}/admin/promo-codes/{code}", json={"active": False}, timeout=15)
        assert r.status_code == 200
        items = {p["code"]: p for p in admin_session.get(f"{API}/admin/promo-codes", timeout=15).json()}
        assert items[code]["active"] is False

    def test_delete_unused(self, admin_session):
        code = self._new_code()
        admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 5, "amount_off_czk": None,
            "max_uses": None, "note": "", "active": True,
        }, timeout=15)
        r = admin_session.delete(f"{API}/admin/promo-codes/{code}", timeout=15)
        assert r.status_code == 200, r.text
        items = {p["code"] for p in admin_session.get(f"{API}/admin/promo-codes", timeout=15).json()}
        assert code not in items


# ---------- promo validate (public) ----------

class TestPromoValidate:
    def test_percent_discount(self, admin_session):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 25, "amount_off_czk": None,
            "max_uses": None, "note": "", "active": True,
        }, timeout=15)
        try:
            r = requests.get(f"{API}/promo/validate", params={"code": code}, timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("valid") is True
            assert data.get("percent_off") == 25
        finally:
            admin_session.delete(f"{API}/admin/promo-codes/{code}", timeout=15)

    def test_amount_off_discount(self, admin_session):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": None, "amount_off_czk": 100,
            "max_uses": None, "note": "", "active": True,
        }, timeout=15)
        try:
            r = requests.get(f"{API}/promo/validate", params={"code": code}, timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("valid") is True
            assert data.get("amount_off_czk") == 100
        finally:
            admin_session.delete(f"{API}/admin/promo-codes/{code}", timeout=15)

    def test_max_uses_reports_uses_left(self, admin_session):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 10, "amount_off_czk": None,
            "max_uses": 3, "note": "", "active": True,
        }, timeout=15)
        try:
            r = requests.get(f"{API}/promo/validate", params={"code": code}, timeout=15)
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("valid") is True
            assert data.get("uses_left") == 3
        finally:
            admin_session.delete(f"{API}/admin/promo-codes/{code}", timeout=15)

    def test_inactive_rejected(self, admin_session):
        code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        admin_session.post(f"{API}/admin/promo-codes", json={
            "code": code, "percent_off": 10, "amount_off_czk": None,
            "max_uses": None, "note": "", "active": False,
        }, timeout=15)
        try:
            r = requests.get(f"{API}/promo/validate", params={"code": code}, timeout=15)
            assert r.status_code == 200, r.text
            assert r.json().get("valid") is False
        finally:
            admin_session.delete(f"{API}/admin/promo-codes/{code}", timeout=15)
