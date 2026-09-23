"""Atomicity race: reset one ticket to valid, then 10 threads race to check it in. Exactly 1 must win."""
import os
import threading
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": "admin@asiatakeover.eu", "password": "Takeover2026!"}
UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"}

s = requests.Session()
s.headers.update(UA)
r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
assert r.status_code == 200

orders = s.get(f"{BASE_URL}/api/admin/orders?include_unpaid=1", timeout=30).json()
code = next(t["code"] for o in orders for t in o.get("tickets", []) if t.get("status") == "used")

# reset to valid, then race
rr = s.post(f"{BASE_URL}/api/admin/tickets/{code}/reset-checkin", timeout=15)
assert rr.status_code == 200, rr.text

results = []
def racer():
    resp = s.post(f"{BASE_URL}/api/scan/checkin", json={"code": code}, timeout=20)
    results.append((resp.status_code, resp.json().get("result") if resp.status_code == 200 else resp.text[:40]))

racers = [threading.Thread(target=racer) for _ in range(10)]
for th in racers: th.start()
for th in racers: th.join()

valids = sum(1 for _, x in results if x == "valid")
used = sum(1 for _, x in results if x == "used")
print("race results:", results)
print(f"valid={valids} used={used}")
assert valids == 1 and used == 9, "ATOMICITY FAIL"
# leave the ticket valid again
rr = s.post(f"{BASE_URL}/api/admin/tickets/{code}/reset-checkin", timeout=15)
print("reset-back:", rr.status_code)
print("ATOMICITY PASS")
