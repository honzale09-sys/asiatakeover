"""
Scanner/PWA regression tests via the public preview URL.
Focuses on: auth cookie flow, test-mode APIs, scan/checkin flow (invalid/valid/used),
test-ticket isolation from stats/checkin-report, and PWA asset availability.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@asiatakeover.eu"
ADMIN_PASSWORD = "Takeover2026!"

# WAF blocks non-browser UA on /api/scan/* — always send a browser UA.
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Safari/605.1"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


# ---------- PWA assets ----------
class TestPWAAssets:
    def test_manifest(self):
        r = requests.get(f"{BASE_URL}/scanner.webmanifest", headers={"User-Agent": UA}, timeout=15)
        assert r.status_code == 200
        assert "manifest" in r.headers.get("content-type", "").lower() or "json" in r.headers.get("content-type", "").lower()
        j = r.json()
        assert j.get("display") == "standalone"
        assert any(i.get("sizes") == "192x192" for i in j.get("icons", []))
        assert any(i.get("sizes") == "512x512" for i in j.get("icons", []))

    def test_sw(self):
        r = requests.get(f"{BASE_URL}/scanner-sw.js", headers={"User-Agent": UA}, timeout=15)
        assert r.status_code == 200
        assert "javascript" in r.headers.get("content-type", "").lower()

    @pytest.mark.parametrize("size", [180, 192, 512])
    def test_icons(self, size):
        r = requests.get(f"{BASE_URL}/assets/door-icon-{size}.png", headers={"User-Agent": UA}, timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/png")


def _extract_tickets(payload):
    return payload if isinstance(payload, list) else payload.get("tickets", [])


def _codes(tickets):
    return [t.get("code") or t.get("ticket_code") for t in tickets if (t.get("code") or t.get("ticket_code"))]


# One class = one xdist worker (pytest.ini uses --dist loadscope), and every test re-seeds the
# 6 test tickets itself, so the shared test-mode state can never race with another test file.
class TestDoorTestMode:
    def _fresh(self, s):
        assert s.post(f"{BASE_URL}/api/admin/test-tickets/generate-all", timeout=25).status_code in (200, 201)
        assert s.post(f"{BASE_URL}/api/admin/test-tickets/reset", timeout=20).status_code == 200
        return _extract_tickets(s.get(f"{BASE_URL}/api/admin/test-tickets", timeout=15).json())

    def test_generate_all_is_idempotent_6_tickets(self, admin_session):
        self._fresh(admin_session)
        listed = self._fresh(admin_session)  # second call must not pile up duplicates
        assert len(listed) == 6, f"expected 6 test tickets, got {len(listed)}"
        assert all(t["status"] == "valid" for t in listed), listed

    def test_invalid_code(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/scan/checkin", json={"code": "ATF-NOPE00"}, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("result") == "invalid"
        assert (j.get("reason") or "").upper() == "INVALID"

    def test_valid_then_used(self, admin_session):
        listed = self._fresh(admin_session)
        code = _codes(listed)[0]

        j1 = admin_session.post(f"{BASE_URL}/api/scan/checkin", json={"code": code}, timeout=15).json()
        assert j1.get("result") == "valid", j1
        assert j1.get("test") is True
        assert "wristband" in j1["admission"] and "gift" in j1["admission"], j1

        j2 = admin_session.post(f"{BASE_URL}/api/scan/checkin", json={"code": code}, timeout=15).json()
        assert j2.get("result") == "used", j2
        assert (j2.get("reason") or "").upper().replace("_", " ") == "ALREADY USED"
        assert j2.get("ticket", {}).get("checked_in_at"), j2

    def test_no_test_data_in_real_statistics(self, admin_session):
        codes = _codes(self._fresh(admin_session))
        for code in codes:
            admin_session.post(f"{BASE_URL}/api/scan/checkin", json={"code": code}, timeout=15)

        stats = admin_session.get(f"{BASE_URL}/api/admin/stats", timeout=15).json()
        report = admin_session.get(f"{BASE_URL}/api/admin/checkin-report", timeout=15).json()

        # Code-scoped: immune to other workers creating/removing their own orders in parallel.
        seen = {s.get("code") for s in stats.get("recent_scans", [])}
        seen |= {g.get("code") for g in stats.get("guest_tickets", [])}
        seen |= {s.get("code") for s in report.get("scans", [])}
        leaked = set(codes) & seen
        assert not leaked, f"test ticket(s) leaked into real statistics: {leaked}"

        for row in report.get("by_tier", []):
            assert not (row.get("tier_name") or "").upper().startswith("TEST"), row
        # Global counter equality is asserted deterministically in tests/test_test_mode.py (in-process).


class TestDiscountGuard:
    def test_gold_and_group_reject_discount(self, admin_session):
        admin_session.post(
            f"{BASE_URL}/api/admin/promo-codes",
            json={"code": "TESTBLK1", "percent_off": 10, "note": "regression guard"},
            timeout=15,
        )
        try:
            site = requests.get(f"{BASE_URL}/api/site", headers={"User-Agent": UA}, timeout=15).json()
            tiers = site.get("tiers", [])
            gold = next((t for t in tiers if "GOLD" in (t.get("name") or "").upper()), None)
            group = next((t for t in tiers if "GROUP" in (t.get("name") or "").upper()), None)
            assert gold and group, f"gold/group tiers not found: {[t.get('name') for t in tiers]}"

            for tier in (gold, group):
                r = requests.post(
                    f"{BASE_URL}/api/orders/create",
                    json={
                        "tier_id": tier["id"],
                        "quantity": 1,
                        "name": "TEST Block",
                        "email": "TEST_block@example.com",
                        "phone": "+420123456789",
                        "promo_code": "TESTBLK1",
                    },
                    headers={"User-Agent": UA, "Content-Type": "application/json"},
                    timeout=15,
                )
                assert r.status_code == 400, f"expected 400 for {tier['name']}, got {r.status_code} {r.text}"
                msg = (r.json().get("detail") or "").lower()
                assert "gold table" in msg or "group of 4" in msg, msg
        finally:
            admin_session.delete(f"{BASE_URL}/api/admin/promo-codes/TESTBLK1", timeout=15)
