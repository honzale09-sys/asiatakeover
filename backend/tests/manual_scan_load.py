"""Scanner load test: 1000 lookups + 1000 checkins with concurrency, plus atomicity race check."""
import json
import os
import statistics
import threading
import time
import requests
from dotenv import dotenv_values

_ENV = {**dotenv_values(os.path.join(os.path.dirname(__file__), "..", ".env")), **os.environ}

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://asia-takeover-fest.preview.emergentagent.com").rstrip("/")
ADMIN = {"email": _ENV["ADMIN_EMAIL"], "password": _ENV["ADMIN_PASSWORD"]}
UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"}

s = requests.Session()
s.headers.update(UA)
r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
assert r.status_code == 200, r.text

orders = s.get(f"{BASE_URL}/api/admin/orders?include_unpaid=1", timeout=30).json()
codes = [t["code"] for o in orders for t in o.get("tickets", [])][:25]
assert len(codes) >= 10, f"need some tickets, got {len(codes)}"
print(f"Using {len(codes)} ticket codes")

errors = []
lat = {"lookup": [], "checkin": []}
lock = threading.Lock()


def worker(kind, n):
    for i in range(n):
        code = codes[i % len(codes)]
        t0 = time.time()
        try:
            resp = s.post(f"{BASE_URL}/api/scan/{kind}", json={"code": code}, timeout=20)
            ms = (time.time() - t0) * 1000
            if resp.status_code != 200:
                with lock:
                    errors.append((kind, resp.status_code, resp.text[:80]))
            else:
                body = resp.json()
                if body.get("result") not in ("valid", "used", "invalid", "refunded"):
                    with lock:
                        errors.append((kind, "bad-result", str(body)[:80]))
                with lock:
                    lat[kind].append(ms)
        except Exception as e:
            with lock:
                errors.append((kind, "exc", str(e)[:80]))


# phase 1: 1000 lookups + 1000 checkins across 4 threads each
threads = []
for _ in range(4):
    threads.append(threading.Thread(target=worker, args=("lookup", 250)))
    threads.append(threading.Thread(target=worker, args=("checkin", 250)))
t0 = time.time()
for th in threads:
    th.start()
for th in threads:
    th.join()
dur = time.time() - t0

print(f"PHASE1 done in {dur:.1f}s — 2000 requests, 8 concurrent workers")
for k in ("lookup", "checkin"):
    v = lat[k]
    print(f"{k}: n={len(v)} avg={statistics.mean(v):.0f}ms p95={sorted(v)[int(len(v)*0.95)]:.0f}ms max={max(v):.0f}ms")
print("errors:", len(errors), errors[:5])

# phase 2: atomicity — N threads race to check in ONE fresh valid ticket
fresh = None
for o in orders:
    for t in o.get("tickets", []):
        if t.get("status") == "valid":
            fresh = t["code"]
            break
    if fresh:
        break
results = []
if fresh:
    def racer():
        resp = s.post(f"{BASE_URL}/api/scan/checkin", json={"code": fresh}, timeout=20)
        results.append(resp.json().get("result"))
    racers = [threading.Thread(target=racer) for _ in range(10)]
    for th in racers:
        th.start()
    for th in racers:
        th.join()
    valids = results.count("valid")
    used = results.count("used")
    print(f"PHASE2 race on {fresh}: valid={valids} used={used} other={len(results)-valids-used}")
    assert valids == 1 and used == 9, "ATOMICITY FAIL"
    # restore ticket to valid via the reset endpoint so preview data stays clean
    rr = s.post(f"{BASE_URL}/api/admin/tickets/{fresh}/reset-checkin", timeout=15)
    print("reset:", rr.status_code)
else:
    print("PHASE2 skipped — no valid ticket")

assert not errors, f"FAILURES: {errors[:10]}"
print("LOAD TEST PASS")
