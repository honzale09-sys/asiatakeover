"""Door rehearsal: 1000 distinct test tickets, 4 door phones at realistic tempo.
Each ticket: lookup -> checkin -> duplicate checkin. Seeds marked test data, cleans up at the end."""
import os
import secrets
import statistics
import threading
import time
import uuid
from datetime import datetime, timezone

import requests
from dotenv import dotenv_values
from pymongo import MongoClient

ENV = dotenv_values("/app/backend/.env")
FENV = dotenv_values("/app/frontend/.env")
BASE_URL = FENV["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN = {"email": ENV["ADMIN_EMAIL"], "password": ENV["ADMIN_PASSWORD"]}
UA = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"}
N_TICKETS = int(os.environ.get("N_TICKETS", "1000"))
PHONES = 4
PAUSE = float(os.environ.get("PAUSE", "0.25"))
MARK = {"load_test": True}

db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
now = datetime.now(timezone.utc).isoformat()
event = db.events.find_one({"active": True}, {"_id": 0})
tier = db.ticket_tiers.find_one({"event_id": event["id"]}, {"_id": 0})

# cleanup leftovers from an aborted previous run
db.tickets.delete_many(MARK)
db.orders.delete_many(MARK)

order_id = uuid.uuid4().hex
db.orders.insert_one({
    "id": order_id, "created_at": now, "updated_at": now, "event_id": event["id"], "event_name": event["name"],
    "tier_id": tier["id"], "tier_name": "Standard Ticket", "quantity": N_TICKETS, "amount_czk": 0, "currency": "CZK",
    "buyer_name": "DOOR REHEARSAL", "buyer_email": "rehearsal@example.invalid", "payment_status": "paid",
    "fulfillment_status": "fulfilled", "comp": True, **MARK,
})
existing = {t["code"] for t in db.tickets.find({}, {"code": 1})}
codes = []
while len(codes) < N_TICKETS:
    c = "ATF-" + secrets.token_hex(3).upper()
    if c not in existing:
        existing.add(c)
        codes.append(c)
db.tickets.insert_many([{
    "id": uuid.uuid4().hex, "code": c, "order_id": order_id, "event_id": event["id"], "event_name": event["name"],
    "tier_id": tier["id"], "tier_name": "Standard Ticket", "holder_name": f"Rehearsal {i+1}",
    "status": "valid", "created_at": now, **MARK,
} for i, c in enumerate(codes)])
print(f"seeded {N_TICKETS} test tickets (order {order_id})", flush=True)

s = requests.Session()
s.headers.update(UA)
r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=15)
assert r.status_code == 200, r.text

lock = threading.Lock()
lat = {"lookup": [], "checkin": [], "dup": []}
outcome = {"lookup": {}, "checkin": {}, "dup": {}}
errors, retries = [], []


def call(kind, code):
    for attempt in (1, 2):
        t0 = time.time()
        try:
            resp = s.post(f"{BASE_URL}/api/scan/{kind}", json={"code": code}, timeout=20)
        except Exception as e:
            with lock:
                retries.append((kind, code, "exc", str(e)[:60]))
            time.sleep(1.0)
            continue
        ms = (time.time() - t0) * 1000
        if resp.status_code == 200:
            return resp.json().get("result"), ms
        with lock:
            retries.append((kind, code, resp.status_code, resp.text[:60]))
        if resp.status_code in (429, 401) or resp.status_code >= 500:
            time.sleep(1.0)
            continue
        return f"http{resp.status_code}", ms
    return "failed", 0


def phone(my_codes):
    for code in my_codes:
        for step, kind in (("lookup", "lookup"), ("checkin", "checkin"), ("dup", "checkin")):
            res, ms = call(kind, code)
            with lock:
                outcome[step][res] = outcome[step].get(res, 0) + 1
                lat[step].append(ms)
                expected = "used" if step == "dup" else "valid"
                if res != expected:
                    errors.append((step, code, res))
            time.sleep(PAUSE)


threads = [threading.Thread(target=phone, args=(codes[i::PHONES],)) for i in range(PHONES)]
t0 = time.time()
for th in threads:
    th.start()
for th in threads:
    th.join()
dur = time.time() - t0

print(f"REHEARSAL done in {dur:.0f}s — {N_TICKETS} tickets, {PHONES} phones, {N_TICKETS*3} calls", flush=True)
for k in ("lookup", "checkin", "dup"):
    v = [x for x in lat[k] if x]
    print(f"{k}: {outcome[k]} avg={statistics.mean(v):.0f}ms p95={sorted(v)[int(len(v)*0.95)]:.0f}ms max={max(v):.0f}ms", flush=True)
print(f"transient retries: {len(retries)} {retries[:5]}", flush=True)
print(f"mismatches: {len(errors)} {errors[:10]}", flush=True)

used_in_db = db.tickets.count_documents({**MARK, "status": "used"})
print(f"DB: {used_in_db}/{N_TICKETS} test tickets marked used", flush=True)

dt = db.tickets.delete_many(MARK).deleted_count
do = db.orders.delete_many(MARK).deleted_count
print(f"CLEANUP: deleted {dt} tickets, {do} order; remaining marked: {db.tickets.count_documents(MARK)}", flush=True)

ok = not errors and used_in_db == N_TICKETS and outcome["checkin"].get("valid") == N_TICKETS and outcome["dup"].get("used") == N_TICKETS
print("REHEARSAL PASS" if ok else "REHEARSAL FAIL", flush=True)
