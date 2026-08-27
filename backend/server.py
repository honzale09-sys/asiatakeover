from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import base64
import hashlib
import io
import logging
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import bcrypt
import httpx
import jwt
import qrcode
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument
from starlette.middleware.cors import CORSMiddleware

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


def new_id():
    return uuid.uuid4().hex


# ---------------- auth ----------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": utcnow() + timedelta(hours=12)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh", "exp": utcnow() + timedelta(days=7)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=12 * 3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


async def get_current_admin(request: Request):
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@api_router.post("/auth/login")
async def login(data: LoginIn, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > utcnow():
            raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")
        await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (utcnow() + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    set_auth_cookies(response, create_access_token(user["id"], email), create_refresh_token(user["id"]))
    return {"id": user["id"], "email": email, "name": user.get("name", "Admin"),
            "role": user.get("role", "admin")}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(admin=Depends(get_current_admin)):
    return admin


# ---------------- public site ----------------

def make_qr(data: str) -> str:
    img = qrcode.make(data, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


@api_router.get("/")
async def root():
    return {"message": "ASIA TAKEOVER FESTIVAL API"}


@api_router.get("/site")
async def get_site():
    event = await db.events.find_one({"active": True}, {"_id": 0})
    if not event:
        raise HTTPException(404, "No active event")
    tiers = await db.ticket_tiers.find({"event_id": event["id"]}, {"_id": 0}).to_list(50)
    for t in tiers:
        t["sold"] = await db.tickets.count_documents({"tier_id": t["id"]})
    content = await db.content.find_one({"key": "site"}, {"_id": 0}) or {}
    return {"event": event, "tiers": tiers, "content": content}


class AttributionIn(BaseModel):
    first_touch: Optional[dict] = None
    last_touch: Optional[dict] = None
    fbp: Optional[str] = None
    fbc: Optional[str] = None
    event_source_url: Optional[str] = None


class OrderCreateIn(BaseModel):
    tier_id: str
    quantity: int = Field(ge=1, le=10)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    attribution: Optional[AttributionIn] = None
    marketing_consent: bool = False


# ---------------- payments config ----------------

SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")
GOPAY_BASE_URL = os.environ.get("GOPAY_BASE_URL", "").rstrip("/")
GOPAY_GO_ID = os.environ.get("GOPAY_GO_ID", "")
GOPAY_CLIENT_ID = os.environ.get("GOPAY_CLIENT_ID", "")
GOPAY_CLIENT_SECRET = os.environ.get("GOPAY_CLIENT_SECRET", "")
META_PIXEL_ID = os.environ.get("META_PIXEL_ID", "")
META_CAPI_TOKEN = os.environ.get("META_CAPI_ACCESS_TOKEN", "")
META_TEST_EVENT_CODE = os.environ.get("META_TEST_EVENT_CODE", "")
META_API_VERSION = os.environ.get("META_API_VERSION", "v21.0")

GOPAY_STATE_MAP = {
    "CREATED": "created",
    "PAYMENT_METHOD_CHOSEN": "pending",
    "PAID": "paid",
    "AUTHORIZED": "paid",
    "CANCELED": "cancelled",
    "TIMEOUTED": "timeouted",
    "REFUNDED": "refunded",
    "PARTIALLY_REFUNDED": "partially_refunded",
}


def gopay_configured() -> bool:
    return bool(GOPAY_BASE_URL and GOPAY_GO_ID and GOPAY_CLIENT_ID and GOPAY_CLIENT_SECRET)


_gopay_token_cache = {"token": None, "exp": 0.0}


async def gopay_token() -> str:
    if _gopay_token_cache["token"] and _gopay_token_cache["exp"] > time.time() + 60:
        return _gopay_token_cache["token"]
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{GOPAY_BASE_URL}/oauth2/token",
            auth=(GOPAY_CLIENT_ID, GOPAY_CLIENT_SECRET),
            data={"grant_type": "client_credentials", "scope": "payment-all"},
            headers={"Accept": "application/json"},
        )
    r.raise_for_status()
    body = r.json()
    _gopay_token_cache["token"] = body["access_token"]
    _gopay_token_cache["exp"] = time.time() + int(body.get("expires_in", 1800))
    return _gopay_token_cache["token"]


async def gopay_create_payment(order: dict) -> dict:
    token = await gopay_token()
    payload = {
        "amount": order["amount_czk"] * 100,
        "currency": "CZK",
        "order_number": order["id"],
        "order_description": f"{order['tier_name']} x{order['quantity']}",
        "payer": {"contact": {"email": order["buyer_email"]}},
        "target": {"type": "ACCOUNT", "goid": int(GOPAY_GO_ID)},
        "callback": {
            "return_url": f"{SITE_URL}/success?order_id={order['id']}",
            "notification_url": f"{SITE_URL}/api/payments/gopay/notification",
        },
        "lang": "EN",
    }
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(
            f"{GOPAY_BASE_URL}/payments/payment",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
    if r.is_error:
        logger.error("GoPay payment create failed: HTTP %s", r.status_code)
        raise HTTPException(502, "Payment gateway error")
    return r.json()


async def gopay_get_payment(payment_id: str) -> dict:
    token = await gopay_token()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(
            f"{GOPAY_BASE_URL}/payments/payment/{payment_id}",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        )
    r.raise_for_status()
    return r.json()


# ---------------- Meta CAPI ----------------

def sha256_norm(value: str) -> str:
    return hashlib.sha256(re.sub(r"\s+", "", value.strip().lower()).encode()).hexdigest()


async def send_capi_purchase(order: dict):
    event_id = f"purchase_{order['id']}"
    if not META_CAPI_TOKEN or not META_PIXEL_ID:
        logger.info("Meta CAPI not configured — skipping server Purchase %s", event_id)
        return
    if await db.meta_events.find_one({"event_id": event_id}):
        return
    attr = order.get("attribution") or {}
    user_data = {}
    if order.get("marketing_consent"):
        user_data["em"] = [sha256_norm(order["buyer_email"])]
        if order.get("client_ip"):
            user_data["client_ip_address"] = order["client_ip"]
        if order.get("user_agent"):
            user_data["client_user_agent"] = order["user_agent"]
        if attr.get("fbp"):
            user_data["fbp"] = attr["fbp"]
        if attr.get("fbc"):
            user_data["fbc"] = attr["fbc"]
    event = {
        "event_name": "Purchase",
        "event_time": int(time.time()),
        "event_id": event_id,
        "action_source": "website",
        "event_source_url": attr.get("event_source_url") or SITE_URL,
        "user_data": user_data,
        "custom_data": {
            "value": order["amount_czk"],
            "currency": "CZK",
            "content_ids": [order["tier_id"]],
            "content_type": "product",
            "content_name": order["tier_name"],
            "num_items": order["quantity"],
            "order_id": order["id"],
        },
    }
    body = {"data": [event]}
    if META_TEST_EVENT_CODE:
        body["test_event_code"] = META_TEST_EVENT_CODE
    url = f"https://graph.facebook.com/{META_API_VERSION}/{META_PIXEL_ID}/events"
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, params={"access_token": META_CAPI_TOKEN}, json=body)
        await db.meta_events.insert_one(
            {"event_id": event_id, "sent_at": utcnow().isoformat(), "http_status": r.status_code}
        )
        if r.status_code >= 400:
            logger.error("Meta CAPI rejected Purchase for order %s: HTTP %s", order["id"], r.status_code)
    except Exception as e:
        logger.error("Meta CAPI send failed for order %s: %s", order["id"], type(e).__name__)


# ---------------- fulfillment & reconciliation ----------------

async def fulfill_order(order_id: str):
    order = await db.orders.find_one_and_update(
        {"id": order_id, "fulfillment_status": {"$ne": "fulfilled"}},
        {"$set": {
            "fulfillment_status": "fulfilled",
            "payment_status": "paid",
            "paid_at": utcnow().isoformat(),
            "updated_at": utcnow().isoformat(),
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not order:
        return
    for _ in range(order["quantity"]):
        code = "ATF-" + secrets.token_hex(3).upper()
        await db.tickets.insert_one({
            "id": new_id(), "code": code, "order_id": order["id"],
            "event_id": order["event_id"], "event_name": order["event_name"],
            "tier_id": order["tier_id"], "tier_name": order["tier_name"],
            "holder_name": order["buyer_name"], "buyer_email": order["buyer_email"],
            "status": "valid", "created_at": utcnow().isoformat(),
            "checked_in_at": None, "checked_in_by": None,
        })
    await send_capi_purchase(order)
    logger.info(
        "Order %s fulfilled: %d ticket(s) issued (email provider not configured — confirmation email pending)",
        order["id"], order["quantity"],
    )


async def provider_status(payment_id: str):
    if str(payment_id).startswith("SIM-"):
        doc = await db.sim_payments.find_one({"id": str(payment_id)})
        if not doc:
            raise HTTPException(404, "Unknown payment")
        return doc["state"], doc
    p = await gopay_get_payment(payment_id)
    return p.get("state", "CREATED"), p


async def reconcile_payment(payment_id: str) -> str:
    order = await db.orders.find_one({"gopay_payment_id": str(payment_id)})
    if not order:
        raise HTTPException(404, "Unknown payment")
    state, raw = await provider_status(str(payment_id))
    if not str(payment_id).startswith("SIM-"):
        if (raw.get("amount") != order["amount_czk"] * 100
                or raw.get("currency") != "CZK"
                or raw.get("order_number") != order["id"]):
            logger.error("GoPay payment mismatch for order %s", order["id"])
            raise HTTPException(400, "Payment does not match order")
    new_status = GOPAY_STATE_MAP.get(state, "created")
    await db.orders.update_one(
        {"id": order["id"]},
        {"$set": {"payment_status": new_status, "updated_at": utcnow().isoformat()}},
    )
    if new_status == "paid":
        await fulfill_order(order["id"])
    elif new_status in ("refunded", "partially_refunded"):
        await db.tickets.update_many(
            {"order_id": order["id"], "status": "valid"},
            {"$set": {"status": "refunded"}},
        )
    return new_status


# ---------------- order endpoints ----------------

_rate_hits = {}


def rate_limit(ip: str, limit: int = 10, window: int = 300):
    now = time.time()
    hits = [t for t in _rate_hits.get(ip, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "Too many requests. Try again later.")
    hits.append(now)
    _rate_hits[ip] = hits


@api_router.post("/orders/create")
async def create_order(data: OrderCreateIn, request: Request):
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown")
    rate_limit(ip)
    event = await db.events.find_one({"active": True}, {"_id": 0})
    if not event:
        raise HTTPException(404, "No active event")
    tier = await db.ticket_tiers.find_one({"id": data.tier_id}, {"_id": 0})
    if not tier or tier["event_id"] != event["id"]:
        raise HTTPException(404, "Ticket tier not found")
    sold = await db.tickets.count_documents({"tier_id": tier["id"]})
    if sold + data.quantity > tier["capacity"]:
        raise HTTPException(400, "Not enough tickets left in this tier")
    order = {
        "id": new_id(),
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
        "event_id": event["id"],
        "event_name": event["name"],
        "tier_id": tier["id"],
        "tier_name": tier["name"],
        "quantity": data.quantity,
        "amount_czk": tier["price_czk"] * data.quantity,
        "currency": "CZK",
        "buyer_name": data.name,
        "buyer_email": data.email.lower(),
        "payment_status": "created",
        "gopay_payment_id": None,
        "paid_at": None,
        "fulfillment_status": "pending",
        "marketing_consent": data.marketing_consent,
        "attribution": data.attribution.model_dump() if data.attribution else None,
        "client_ip": ip,
        "user_agent": request.headers.get("user-agent"),
    }
    if gopay_configured():
        p = await gopay_create_payment(order)
        order["gopay_payment_id"] = str(p["id"])
        payment_url = p["gw_url"]
        mode = "gopay"
    else:
        pid = f"SIM-{order['id']}"
        order["gopay_payment_id"] = pid
        payment_url = f"/pay/{order['id']}"
        mode = "simulation"
        await db.sim_payments.insert_one({"id": pid, "state": "CREATED", "order_id": order["id"]})
    await db.orders.insert_one(order)
    return {
        "order_id": order["id"],
        "payment_url": payment_url,
        "mode": mode,
        "amount_czk": order["amount_czk"],
        "currency": "CZK",
    }


@api_router.get("/orders/{order_id}/status")
async def order_status(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return {
        "order_id": order["id"],
        "payment_status": order.get("payment_status", "created"),
        "amount_czk": order["amount_czk"],
        "currency": "CZK",
        "tier_id": order["tier_id"],
        "tier_name": order["tier_name"],
        "quantity": order["quantity"],
        "event_name": order.get("event_name", ""),
        "purchase_event_id": f"purchase_{order['id']}",
    }


@api_router.get("/orders/{order_id}/tickets")
async def order_tickets(order_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("payment_status") not in ("paid", "paid_mock"):
        raise HTTPException(403, "Tickets are available only after the payment is confirmed")
    tickets = await db.tickets.find({"order_id": order_id}, {"_id": 0}).to_list(50)
    return {"order_id": order_id, "tickets": [{**t, "qr": make_qr(t["code"])} for t in tickets]}


@api_router.get("/payments/gopay/notification")
async def gopay_notification(id: str = Query(...)):
    try:
        await reconcile_payment(id)
    except HTTPException as e:
        if e.status_code == 404:
            return {"ok": True}
        raise HTTPException(502, "Reconciliation failed")
    except Exception:
        raise HTTPException(502, "Reconciliation failed")
    return {"ok": True}


@api_router.get("/payments/gopay/return")
async def gopay_return(id: str = Query(...)):
    try:
        await reconcile_payment(id)
    except Exception:
        pass
    order = await db.orders.find_one({"gopay_payment_id": str(id)})
    dest = f"{SITE_URL}/success?order_id={order['id']}" if order else f"{SITE_URL}/success"
    return RedirectResponse(dest)


class SimActionIn(BaseModel):
    order_id: str
    action: str = ""


@api_router.post("/payments/sim/action")
async def sim_action(data: SimActionIn):
    if gopay_configured():
        raise HTTPException(404, "Not available")
    state = {"paid": "PAID", "failed": "CANCELED", "cancelled": "CANCELED", "timeout": "TIMEOUTED"}.get(data.action)
    if not state:
        raise HTTPException(400, "Unknown action")
    pid = f"SIM-{data.order_id}"
    res = await db.sim_payments.update_one({"id": pid}, {"$set": {"state": state}})
    if res.matched_count == 0:
        raise HTTPException(404, "Unknown order")
    status = await reconcile_payment(pid)
    return {"payment_status": status}


@api_router.post("/payments/sim/notify")
async def sim_notify(data: SimActionIn):
    if gopay_configured():
        raise HTTPException(404, "Not available")
    status = await reconcile_payment(f"SIM-{data.order_id}")
    return {"payment_status": status}


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    topic: str = "general"
    message: str = Field(min_length=1, max_length=4000)


@api_router.post("/contact")
async def contact(data: ContactIn):
    doc = {"id": new_id(), **data.model_dump(), "created_at": utcnow().isoformat()}
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- scanner (door staff) ----------------

class ScanIn(BaseModel):
    code: str


async def find_ticket(code: str):
    clean = code.strip().upper()
    if "ATF-" in clean:
        clean = clean[clean.index("ATF-"):]
    return await db.tickets.find_one({"code": clean}, {"_id": 0})


@api_router.post("/scan/lookup")
async def scan_lookup(data: ScanIn, admin=Depends(get_current_admin)):
    t = await find_ticket(data.code)
    if not t:
        return {"result": "invalid", "ticket": None}
    return {"result": t["status"], "ticket": t}


@api_router.post("/scan/checkin")
async def scan_checkin(data: ScanIn, admin=Depends(get_current_admin)):
    t = await find_ticket(data.code)
    if not t:
        return {"result": "invalid", "ticket": None}
    if t["status"] == "used":
        return {"result": "used", "ticket": t}
    ts = utcnow().isoformat()
    await db.tickets.update_one({"id": t["id"]},
                                {"$set": {"status": "used", "checked_in_at": ts,
                                          "checked_in_by": admin.get("email")}})
    t["status"] = "used"
    t["checked_in_at"] = ts
    return {"result": "valid", "ticket": t}


# ---------------- admin ----------------

@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(get_current_admin)):
    orders = await db.orders.find({}, {"_id": 0}).to_list(100000)
    revenue = sum(o["amount_czk"] for o in orders)
    tickets_sold = await db.tickets.count_documents({})
    checked_in = await db.tickets.count_documents({"status": "used"})
    tiers = await db.ticket_tiers.find({}, {"_id": 0}).to_list(100)
    per_tier = []
    for t in tiers:
        sold = await db.tickets.count_documents({"tier_id": t["id"]})
        per_tier.append({"name": t["name"], "sold": sold, "capacity": t["capacity"],
                         "revenue": sold * t["price_czk"]})
    recent_scans = await db.tickets.find({"status": "used"}, {"_id": 0}).sort("checked_in_at", -1).to_list(20)
    return {"revenue_czk": revenue, "orders": len(orders), "tickets_sold": tickets_sold,
            "checked_in": checked_in, "per_tier": per_tier, "recent_scans": recent_scans}


@api_router.get("/admin/orders")
async def admin_orders(admin=Depends(get_current_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    for o in orders:
        o["tickets"] = await db.tickets.find({"order_id": o["id"]}, {"_id": 0}).to_list(50)
        o["payment_status"] = o.get("payment_status") or o.get("status", "paid_mock")
    return orders


@api_router.get("/admin/messages")
async def admin_messages(admin=Depends(get_current_admin)):
    return await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


class EventIn(BaseModel):
    name: str
    date: str = ""
    date_label: str = ""
    venue: str = ""
    address: str = ""
    city: str = "Prague"
    description: str = ""
    presented_by: str = ""
    genres: List[str] = []
    lineup: List[dict] = []
    active: bool = True
    capacity: int = 1500


@api_router.get("/admin/events")
async def admin_events(admin=Depends(get_current_admin)):
    return await db.events.find({}, {"_id": 0}).to_list(100)


@api_router.post("/admin/events")
async def create_event(data: EventIn, admin=Depends(get_current_admin)):
    doc = {"id": new_id(), **data.model_dump(), "created_at": utcnow().isoformat()}
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/events/{event_id}")
async def update_event(event_id: str, data: EventIn, admin=Depends(get_current_admin)):
    res = await db.events.update_one({"id": event_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Event not found")
    return await db.events.find_one({"id": event_id}, {"_id": 0})


@api_router.delete("/admin/events/{event_id}")
async def delete_event(event_id: str, admin=Depends(get_current_admin)):
    await db.events.delete_one({"id": event_id})
    await db.ticket_tiers.delete_many({"event_id": event_id})
    return {"ok": True}


class TierIn(BaseModel):
    event_id: str
    name: str
    price_czk: int = Field(ge=0)
    capacity: int = Field(ge=1)
    description: str = ""
    perks: List[str] = []


@api_router.get("/admin/tiers")
async def admin_tiers(admin=Depends(get_current_admin)):
    tiers = await db.ticket_tiers.find({}, {"_id": 0}).to_list(200)
    for t in tiers:
        t["sold"] = await db.tickets.count_documents({"tier_id": t["id"]})
    return tiers


@api_router.post("/admin/tiers")
async def create_tier(data: TierIn, admin=Depends(get_current_admin)):
    doc = {"id": new_id(), **data.model_dump()}
    await db.ticket_tiers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/tiers/{tier_id}")
async def update_tier(tier_id: str, data: TierIn, admin=Depends(get_current_admin)):
    res = await db.ticket_tiers.update_one({"id": tier_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Tier not found")
    return await db.ticket_tiers.find_one({"id": tier_id}, {"_id": 0})


@api_router.delete("/admin/tiers/{tier_id}")
async def delete_tier(tier_id: str, admin=Depends(get_current_admin)):
    sold = await db.tickets.count_documents({"tier_id": tier_id})
    if sold > 0:
        raise HTTPException(400, f"Cannot delete: {sold} tickets already sold for this tier")
    await db.ticket_tiers.delete_one({"id": tier_id})
    return {"ok": True}


class ContentIn(BaseModel):
    announcement: str = ""
    hero_sub: str = ""
    contact_email: str = ""
    instagram: str = ""


@api_router.put("/admin/content")
async def update_content(data: ContentIn, admin=Depends(get_current_admin)):
    await db.content.update_one({"key": "site"},
                                {"$set": {**data.model_dump(), "key": "site"}}, upsert=True)
    return await db.content.find_one({"key": "site"}, {"_id": 0})


# ---------------- seed ----------------

DEFAULT_LINEUP = [
    {"name": "DJ GANGSHII", "genre": "Pop Hits", "stage": "Main Stage", "time": "02:00", "origin": "Seoul"},
    {"name": "SEOULKISS", "genre": "K-POP", "stage": "K-POP Sky Terrace", "time": "23:00", "origin": "Seoul"},
    {"name": "HANA BEATS", "genre": "K-POP", "stage": "Main Stage", "time": "21:00", "origin": "Tokyo"},
    {"name": "MC RYU", "genre": "HipHop/RnB", "stage": "Main Stage", "time": "00:00", "origin": "Osaka"},
    {"name": "DJ SABLE", "genre": "HipHop/RnB", "stage": "Soju Rooftop Lounge", "time": "22:00", "origin": "London"},
    {"name": "VIETKONG", "genre": "Vinahouse", "stage": "Vinahouse Vault", "time": "01:00", "origin": "Ho Chi Minh City"},
    {"name": "DJ LOTUS", "genre": "Vinahouse", "stage": "Vinahouse Vault", "time": "23:30", "origin": "Hanoi"},
    {"name": "TOKYO NOVA", "genre": "J-POP", "stage": "K-POP Sky Terrace", "time": "20:00", "origin": "Tokyo"},
    {"name": "SAKURA WAVE", "genre": "J-POP", "stage": "Soju Rooftop Lounge", "time": "21:30", "origin": "Kyoto"},
    {"name": "GANGSHII DANCE CREW", "genre": "Choreography Dance", "stage": "Main Stage", "time": "22:30", "origin": "Prague × Seoul"},
]

DEFAULT_TIERS = [
    {"name": "Early Bird", "price_czk": 490, "capacity": 300,
     "description": "First wave — cheapest entry, all floors.",
     "perks": ["Entry to all 3 floors + 2 rooftops", "Access to both photobooth zones", "Soju welcome shot"]},
    {"name": "General Admission", "price_czk": 690, "capacity": 800,
     "description": "Full festival access, all night long.",
     "perks": ["Entry to all 3 floors + 2 rooftops", "Access to both photobooth zones", "Open until 05:00"]},
    {"name": "VIP Sky Lounge", "price_czk": 1490, "capacity": 250,
     "description": "Elevated views over Wenceslas Square.",
     "perks": ["VIP zone + sky terrace access", "Welcome soju cocktail", "Separate VIP entrance", "Cloakroom included"]},
    {"name": "Ultra VIP Table", "price_czk": 4990, "capacity": 50,
     "description": "Private table for you and your crew.",
     "perks": ["Private table (up to 4 guests)", "Bottle service included", "Priority photobooth access", "Dedicated host"]},
]

DEFAULT_CONTENT = {
    "key": "site",
    "announcement": "EARLY BIRD TICKETS LIVE NOW — 27.09.2026 — DUPLEX PRAGUE",
    "hero_sub": "The biggest Asian festival in Prague. 3 floors. 10 international DJs. 2 rooftops. One night only.",
    "contact_email": "info@asiatakeover.eu",
    "instagram": "@asiatakeover.prague",
}


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Festival Admin", "role": "admin",
            "created_at": utcnow().isoformat(),
        })
        logger.info("Admin user seeded: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated from env")


async def seed_event():
    if await db.events.count_documents({}) == 0:
        event = {
            "id": new_id(),
            "name": "ASIA TAKEOVER FESTIVAL 2026",
            "date": "2026-09-27T20:00:00+02:00",
            "date_label": "27.09.2026",
            "venue": "DUPLEX",
            "address": "Václavské náměstí 831/21, 110 00 Praha 1",
            "city": "Prague",
            "description": "The biggest Asian festival in Prague takes over the legendary DUPLEX club on Wenceslas Square. 3 floors, 10 international DJs, 2 rooftop terraces, 2 photobooth zones and rivers of soju — one night only.",
            "presented_by": "DUPLEX × SEOULVIBES × GANGSHII",
            "genres": ["K-POP", "HipHop/RnB", "Vinahouse", "J-POP", "Pop Hits", "Choreography Dance"],
            "lineup": DEFAULT_LINEUP,
            "active": True,
            "capacity": 1500,
        }
        await db.events.insert_one(event)
        for t in DEFAULT_TIERS:
            await db.ticket_tiers.insert_one({"id": new_id(), "event_id": event["id"], **t})
        logger.info("Default event + tiers seeded")
    if await db.content.count_documents({"key": "site"}) == 0:
        await db.content.insert_one(DEFAULT_CONTENT)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.tickets.create_index("code", unique=True)
    await db.tickets.create_index("order_id")
    await db.sim_payments.create_index("id", unique=True)
    await db.meta_events.create_index("event_id", unique=True)
    await seed_admin()
    await seed_event()


app.include_router(api_router)

_origins = [o for o in [os.environ.get("FRONTEND_URL"), "http://localhost:3000"] if o]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
