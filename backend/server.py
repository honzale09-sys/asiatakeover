from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import base64
import asyncio
import hashlib
import io
import ipaddress
import json
import logging
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from html import escape
from html.parser import HTMLParser
from typing import List, Optional
from urllib.parse import urlparse

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


@api_router.post("/auth/refresh")
async def refresh_tokens(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(401, "Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    set_auth_cookies(response, create_access_token(user["id"], user["email"]), create_refresh_token(user["id"]))
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
        if "GOLD" in t["name"].upper():
            # gold tier capacity counts TABLES; one paid order = one table
            t["sold"] = await db.orders.count_documents({"tier_id": t["id"], "payment_status": "paid"})
        else:
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
    quantity: int = Field(ge=1, le=14)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=30)
    attribution: Optional[AttributionIn] = None
    marketing_consent: bool = False
    promo_code: Optional[str] = None


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

TEYA_ENV = os.environ.get("TEYA_ENV", "sandbox")
TEYA_CLIENT_ID = os.environ.get("TEYA_CLIENT_ID", "")
TEYA_CLIENT_SECRET = os.environ.get("TEYA_CLIENT_SECRET", "")
TEYA_STORE_ID = os.environ.get("TEYA_STORE_ID", "")
TEYA_WEBHOOK_PUBLIC_KEY = os.environ.get("TEYA_WEBHOOK_PUBLIC_KEY", "")

TEYA_STATE_MAP = {
    "SUCCESS": "paid", "SUCCEEDED": "paid", "COMPLETED": "paid", "AUTHORIZED": "paid", "PAID": "paid",
    "PENDING": "pending", "CREATED": "created", "SESSION_CREATED": "created",
    "FAILED": "failed", "CANCELLED": "cancelled", "CANCELED": "cancelled",
    "EXPIRED": "timeouted", "REFUNDED": "refunded", "PARTIALLY_REFUNDED": "partially_refunded",
}

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


def ticket_display_name(tier_name: str) -> str:
    n = (tier_name or "").upper()
    if "GOLD" in n:
        return "VIP GOLD"
    return "VIP Table Ticket" if "VIP" in n else "Standard Ticket"


def gopay_configured() -> bool:
    return bool(GOPAY_BASE_URL and GOPAY_GO_ID and GOPAY_CLIENT_ID and GOPAY_CLIENT_SECRET)


def payment_sim_allowed() -> bool:
    if os.environ.get("ALLOW_PAYMENT_SIM", "").lower() not in ("1", "true", "yes"):
        return False
    return "asiatakeover.com" not in SITE_URL


# ---------------- Teya (hosted checkout) ----------------

def teya_configured() -> bool:
    return bool(TEYA_CLIENT_ID and TEYA_CLIENT_SECRET and TEYA_STORE_ID)


def _teya_hosts():
    prod = TEYA_ENV == "production"
    return (
        "https://api.teya.com" if prod else "https://api.teya.xyz",
        "https://id.teya.com/oauth/v2/oauth-token" if prod else "https://id.teya.xyz/oauth/v2/oauth-token",
    )


_teya_token_cache = {"token": None, "exp": 0.0}


async def teya_token() -> str:
    if _teya_token_cache["token"] and _teya_token_cache["exp"] > time.time() + 60:
        return _teya_token_cache["token"]
    _, oauth = _teya_hosts()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            oauth,
            data={"grant_type": "client_credentials",
                  "scope": "checkout/sessions/create checkout/sessions/id/get"},
            auth=(TEYA_CLIENT_ID, TEYA_CLIENT_SECRET),
        )
    if r.is_error:
        logger.error("Teya auth failed: HTTP %s", r.status_code)
        raise HTTPException(502, "Payment gateway authentication failed")
    body = r.json()
    _teya_token_cache["token"] = body["access_token"]
    _teya_token_cache["exp"] = time.time() + int(body.get("expires_in", 1800))
    return body["access_token"]


async def teya_create_session(order: dict) -> dict:
    api, _ = _teya_hosts()
    token = await teya_token()
    payload = {
        "store_id": TEYA_STORE_ID,
        "amount": {"currency": "CZK", "value": order["amount_czk"] * 100},
        "type": "SALE",
        "merchant_reference": order["id"],
        "success_url": f"{SITE_URL}/success?order_id={order['id']}",
        "failure_url": f"{SITE_URL}/success?order_id={order['id']}",
        "cancel_url": f"{SITE_URL}/tickets",
        "post_success_payment": "REDIRECT",
        "language": "cs-CZ",
        "customer": {"email": order["buyer_email"]},
        "metadata": {"order_id": order["id"]},
    }
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(
            f"{api}/v2/checkout/sessions",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"teya-{order['id']}"},
        )
    if r.is_error:
        logger.error("Teya session create failed: HTTP %s — %s", r.status_code, r.text[:300])
        raise HTTPException(502, "Payment gateway error")
    return r.json()


async def teya_get_session(session_id: str) -> dict:
    api, _ = _teya_hosts()
    token = await teya_token()
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{api}/v2/checkout/sessions/{session_id}",
                        headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()


async def teya_reconcile(session_id: str) -> str:
    order = await db.orders.find_one({"teya_session_id": str(session_id)})
    if not order:
        raise HTTPException(404, "Unknown payment")
    raw = await teya_get_session(session_id)
    amount = raw.get("amount") or {}
    if (raw.get("merchant_reference") not in (None, order["id"])
            or (amount.get("value") is not None and int(amount["value"]) != order["amount_czk"] * 100)
            or amount.get("currency", "CZK") != "CZK"):
        logger.error("Teya session mismatch for order %s", order["id"])
        raise HTTPException(400, "Payment does not match order")
    state = str(raw.get("payment_status") or raw.get("session_status") or "CREATED").upper()
    new_status = TEYA_STATE_MAP.get(state, "created")
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


async def teya_reconcile_sweep():
    """Safety net: every 2 min re-check recent unpaid Teya orders server-side, so a payment
    gets confirmed even when the buyer closes the browser and the webhook fails."""
    await asyncio.sleep(45)
    while True:
        try:
            if teya_configured():
                cutoff = (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat()
                cursor = db.orders.find({
                    "payment_status": {"$in": ["created", "pending"]},
                    "teya_session_id": {"$ne": None},
                    "created_at": {"$gte": cutoff},
                }, {"_id": 0, "id": 1, "teya_session_id": 1})
                async for o in cursor:
                    try:
                        await teya_reconcile(o["teya_session_id"])
                    except Exception as e:
                        logger.debug("Sweep reconcile order %s: %s", o["id"], str(e)[:120])
                    await asyncio.sleep(0.5)
        except Exception as e:
            logger.warning("Teya reconcile sweep error: %s", str(e)[:150])
        await asyncio.sleep(120)


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


def _capi_user_data(order: dict) -> dict:
    if not order.get("marketing_consent"):
        return {}
    attr = order.get("attribution") or {}
    user_data = {"em": [sha256_norm(order["buyer_email"])]}
    optional = (("client_ip_address", order.get("client_ip")), ("client_user_agent", order.get("user_agent")),
                ("fbp", attr.get("fbp")), ("fbc", attr.get("fbc")))
    user_data.update({k: v for k, v in optional if v})
    return user_data


def _capi_event(order: dict, event_id: str) -> dict:
    attr = order.get("attribution") or {}
    return {
        "event_name": "Purchase",
        "event_time": int(time.time()),
        "event_id": event_id,
        "action_source": "website",
        "event_source_url": attr.get("event_source_url") or SITE_URL,
        "user_data": _capi_user_data(order),
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


async def send_capi_purchase(order: dict):
    event_id = f"purchase_{order['id']}"
    if not META_CAPI_TOKEN or not META_PIXEL_ID:
        logger.info("Meta CAPI not configured — skipping server Purchase %s", event_id)
        return
    if await db.meta_events.find_one({"event_id": event_id}):
        return
    body = {"data": [_capi_event(order, event_id)]}
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


# ---------------- transactional email (Emergent managed Resend) ----------------

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Asia Takeover")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO") or None
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "Asia Takeover <hello@asiatakeover.com>")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _check_no_forms(scan: "_EmailScan") -> None:
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email")


def _check_no_credential_asks(subject: str, html: str) -> None:
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks recipient for credentials: {p!r}")


def _check_url_safety(urls: list) -> None:
    for url in urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r}")
        parsed = urlparse(low)
        if not _host_ok(parsed.hostname or "") or parsed.username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r}")


def _check_anchor_text(anchors: list) -> None:
    for href, text in anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r}")


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    _check_no_forms(scan)
    _check_no_credential_asks(subject, html)
    _check_url_safety(scan.urls)
    _check_anchor_text(scan.anchors)


async def email_rate_gate():
    """Cluster-wide throttle: min interval between email API calls across all pods,
    enforced via an atomic Mongo update. Prevents bursts from tripping the provider rate limit."""
    for _ in range(60):
        now = time.time()
        doc = await db.email_rate.find_one_and_update(
            {"key": "gate", "last": {"$lt": now - 8}},
            {"$set": {"last": now}},
            return_document=ReturnDocument.AFTER,
        )
        if doc:
            return
        try:
            await db.email_rate.insert_one({"key": "gate", "last": 0.0})
        except Exception:
            pass
        await asyncio.sleep(2)
    logger.warning("Email rate gate wait exceeded — sending anyway")


async def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None):
    _assert_safe_email(subject, html)
    if RESEND_API_KEY:
        return await _send_email_resend(to=to, subject=subject, html=html, reply_to=reply_to)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    await email_rate_gate()
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(
            f"{EMAIL_BASE_URL}/api/v1/email/send",
            headers={"X-Email-Key": EMAIL_KEY},
            json=payload,
        )
    if resp.status_code == 422:
        logger.error("Email rejected as undeliverable for %s: %s", to, resp.text[:200])
        raise RuntimeError("Undeliverable recipient — email API blocked this address (422). Check the buyer email is real.")
    if resp.status_code >= 400:
        logger.error("Email send rejected: HTTP %s — %s", resp.status_code, resp.text[:300])
        raise RuntimeError(f"email API HTTP {resp.status_code}: {resp.text[:200]}")
    return resp.json().get("id")


async def _send_email_resend(*, to: str, subject: str, html: str, reply_to: Optional[str] = None):
    """Direct Resend API (owner's own account + verified domain)."""
    payload = {
        "from": RESEND_FROM,
        "to": [to],
        "subject": subject,
        "html": html,
        "reply_to": reply_to or EMAIL_REPLY_TO or "hello@asiatakeover.com",
    }
    await email_rate_gate()
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json=payload,
        )
    if resp.status_code == 403:
        logger.error("Resend domain not verified: %s", resp.text[:200])
        raise RuntimeError("Resend: domain not verified (403) — finish DNS verification in the Resend dashboard.")
    if resp.status_code == 422:
        logger.error("Resend rejected recipient %s: %s", to, resp.text[:200])
        raise RuntimeError("Undeliverable recipient — Resend rejected this address (422). Check the buyer email is real.")
    if resp.status_code >= 400:
        logger.error("Resend send rejected: HTTP %s — %s", resp.status_code, resp.text[:300])
        raise RuntimeError(f"email API HTTP {resp.status_code}: {resp.text[:200]}")
    return resp.json().get("id")


def build_ticket_email_html(order: dict, tickets: list) -> str:
    n = len(tickets)
    rows = ""
    for i, t in enumerate(tickets, 1):
        rows += (
            f'<tr><td style="padding:28px 0;border-top:1px solid #262739;text-align:center">'
            f'<p style="font-family:Courier New,monospace;letter-spacing:3px;color:#00F0FF;font-size:12px;margin:0 0 14px">'
            f'TICKET {i} OF {n}</p>'
            f'<img src="{SITE_URL}/api/qr/{t["code"]}.png" width="220" height="220" '
            f'alt="QR code for ticket {escape(t["code"])}" '
            f'style="display:block;margin:0 auto;border-radius:10px;background:#ffffff;padding:8px"/>'
            f'<p style="font-family:Courier New,monospace;font-size:17px;font-weight:bold;color:#ffffff;margin:14px 0 2px">'
            f'{escape(t["code"])}</p>'
            f'<p style="font-size:12px;color:#94A3B8;margin:0">{escape(t["tier_name"])}</p>'
            f'</td></tr>'
        )
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060609">'
        '<tr><td align="center" style="padding:24px 12px">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" '
        'style="background:#0D0E15;border-radius:16px;overflow:hidden;max-width:600px;width:100%">'
        f'<tr><td style="padding:32px 24px 8px;text-align:center">'
        f'<img src="{SITE_URL}/assets/logo-atf.png" width="260" alt="ASIA TAKEOVER FESTIVAL" '
        f'style="display:block;margin:0 auto;max-width:80%"/></td></tr>'
        f'<tr><td style="padding:20px 32px;text-align:center">'
        f'<p style="font-family:Courier New,monospace;letter-spacing:3px;color:#FF6A00;font-size:12px;margin:0 0 8px">PAYMENT CONFIRMED</p>'
        f'<p style="font-size:15px;color:#ffffff;margin:0 0 6px">Your payment was successful — see you at the party.</p>'
        f'<p style="font-size:13px;color:#94A3B8;margin:0">Asia Takeover · 27 September 2026 · DUPLEX, Wenceslas Square, Prague</p>'
        f'</td></tr>'
        f'<tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
        f'<tr><td style="padding:14px 0;border-top:1px solid #262739;font-size:13px;color:#94A3B8">'
        f'Order <span style="font-family:Courier New,monospace;color:#ffffff">{escape(order["id"])}</span><br/>'
        f'{escape(order["tier_name"])} × {order["quantity"]} · Total {order["amount_czk"]} CZK</td></tr>'
        f'{rows}'
        f'</table></td></tr>'
        f'<tr><td style="padding:8px 32px 32px;text-align:center">'
        f'<p style="font-size:13px;color:#ffffff;margin:18px 0 8px">Each QR code above is ONE individual entry.</p>'
        f'<p style="font-size:12px;color:#94A3B8;line-height:1.7;margin:0">'
        f'Do not share your QR codes publicly — anyone holding them can enter. '
        f'Have the QR codes ready on your phone at the entrance. Event runs 22:00–05:00, 18+ with valid ID.</p>'
        f'<p style="font-size:12px;margin:20px 0 0">'
        f'<a href="{SITE_URL}/success?order_id={escape(order["id"])}" style="color:#00F0FF">View your tickets online</a></p>'
        f'<p style="font-size:11px;color:#64748B;margin:24px 0 0">Sent by {escape(EMAIL_FROM_NAME)} · '
        f'We never ask for your password or card details by email.</p>'
        f'</td></tr></table></td></tr></table>'
    )


async def send_ticket_email(order: dict):
    tickets = await db.tickets.find({"order_id": order["id"]}, {"_id": 0}).to_list(50)
    if not tickets:
        raise ValueError("No tickets for order")
    subject = "Asia Takeover — Your Tickets 🎟️"
    html = build_ticket_email_html(order, tickets)
    return await send_email(to=order["buyer_email"], subject=subject, html=html)


async def send_ticket_email_with_retry(order_id: str):
    """Background sender: retries transient failures (e.g. HTTP 429 rate limit) with backoff.
    Permanent failures (undeliverable recipient) are not retried."""
    delays = [15, 60, 180, 600, 900, 1800]
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return
    for attempt in range(len(delays) + 1):
        try:
            email_id = await send_ticket_email(order)
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"ticket_email_sent_at": utcnow().isoformat(),
                          "ticket_email_id": email_id, "ticket_email_error": None}},
            )
            logger.info("Ticket email sent for order %s (attempt %d)", order_id, attempt + 1)
            return
        except Exception as e:
            msg = str(e)[:250]
            logger.warning("Ticket email attempt %d failed for order %s: %s", attempt + 1, order_id, msg)
            await db.orders.update_one({"id": order_id}, {"$set": {"ticket_email_error": msg}})
            if "Undeliverable recipient" in msg:
                return
            if attempt < len(delays):
                await asyncio.sleep(delays[attempt])
    logger.error("Ticket email permanently failed for order %s after retries", order_id)


async def retry_unsent_ticket_emails():
    """Startup sweep: resend ticket emails for paid orders whose email previously failed
    transiently (rate limits etc.). Permanent 422 'undeliverable' failures are skipped.
    Single-flight across pods via a Mongo lock; actual send pacing is enforced by email_rate_gate."""
    try:
        now = time.time()
        lock = await db.email_rate.find_one_and_update(
            {"key": "sweep_lock", "until": {"$lt": now}},
            {"$set": {"until": now + 900}},
            return_document=ReturnDocument.AFTER,
        )
        if not lock:
            try:
                await db.email_rate.insert_one({"key": "sweep_lock", "until": now + 900})
            except Exception:
                logger.info("Email retry sweep already running on another pod")
                return
        cursor = db.orders.find({
            "payment_status": "paid",
            "ticket_email_sent_at": None,
            "ticket_email_error": {"$not": {"$regex": "Undeliverable"}},
        })
        n = 0
        async for o in cursor:
            asyncio.create_task(send_ticket_email_with_retry(o["id"]))
            n += 1
            await asyncio.sleep(3)
        if n:
            logger.info("Retrying ticket emails for %d paid order(s)", n)
    except Exception as e:
        logger.warning("Ticket email retry sweep failed: %s", str(e)[:200])


@api_router.get("/qr/{code}.png")
async def qr_png(code: str):
    clean = code.strip().upper()
    if not re.fullmatch(r"ATF-[0-9A-F]{6}", clean):
        raise HTTPException(404, "Unknown code")
    img = qrcode.make(clean, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


# ---------------- ambassadors admin ----------------

class AmbassadorIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    instagram: str = Field(default="", max_length=120)
    email: EmailStr
    code: Optional[str] = Field(default=None, max_length=24)
    discount_czk: int = Field(default=50, ge=1, le=2000)


@api_router.get("/admin/ambassadors")
async def admin_ambassadors_list(admin=Depends(get_current_admin)):
    ambs = await db.ambassadors.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [await ambassador_public_state(a) for a in ambs]


@api_router.post("/admin/ambassadors")
async def admin_ambassador_create(data: AmbassadorIn, admin=Depends(get_current_admin)):
    code = (data.code or "").strip().upper() or ("AMB-" + secrets.token_hex(3).upper())
    if not re.fullmatch(r"[A-Z0-9-]{3,24}", code):
        raise HTTPException(400, "Code must be 3–24 chars: letters, numbers, dashes")
    if await db.ambassadors.find_one({"code": code}) or await db.promo_codes.find_one({"code": code}):
        raise HTTPException(409, "This code is already taken")
    now = utcnow().isoformat()
    doc = {
        "id": new_id(), "name": data.name.strip(), "instagram": data.instagram.strip(),
        "email": data.email.lower(), "code": code, "discount_czk": data.discount_czk,
        "stories_shared": 0, "active": True,
        "created_at": now, "activated_at": now,
        "reward_standard": None, "reward_vip": None, "fifty": None,
    }
    await db.ambassadors.insert_one(doc)
    logger.warning("ADMIN %s created ambassador %s (%s)", admin.get("email"), doc["name"], code)
    return await ambassador_public_state(doc)


class AmbassadorEditIn(BaseModel):
    name: Optional[str] = None
    instagram: Optional[str] = None
    email: Optional[EmailStr] = None
    active: Optional[bool] = None
    discount_czk: Optional[int] = Field(default=None, ge=1, le=2000)


@api_router.put("/admin/ambassadors/{amb_id}")
async def admin_ambassador_edit(amb_id: str, data: AmbassadorEditIn, admin=Depends(get_current_admin)):
    amb = await db.ambassadors.find_one({"id": amb_id})
    if not amb:
        raise HTTPException(404, "Ambassador not found")
    upd = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    if "email" in upd:
        upd["email"] = upd["email"].lower()
    if "name" in upd:
        upd["name"] = upd["name"].strip()
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.ambassadors.update_one({"id": amb_id}, {"$set": upd})
    logger.warning("ADMIN %s edited ambassador %s: %s", admin.get("email"), amb["name"], list(upd))
    return await ambassador_public_state(await db.ambassadors.find_one({"id": amb_id}, {"_id": 0}))


@api_router.post("/admin/ambassadors/{amb_id}/stories")
async def admin_ambassador_stories(amb_id: str, data: dict, admin=Depends(get_current_admin)):
    delta = int(data.get("delta", 0))
    if delta not in (1, -1):
        raise HTTPException(400, "delta must be +1 or -1")
    amb = await db.ambassadors.find_one({"id": amb_id})
    if not amb:
        raise HTTPException(404, "Ambassador not found")
    new_val = min(8, max(0, amb.get("stories_shared", 0) + delta))
    await db.ambassadors.update_one({"id": amb_id}, {"$set": {"stories_shared": new_val}})
    return await ambassador_public_state(await db.ambassadors.find_one({"id": amb_id}, {"_id": 0}))


async def _issue_ambassador_reward(amb: dict, kind: str):
    """kind: 'standard' | 'vip' — creates 0 Kč reward order + ticket + email."""
    event = await db.events.find_one({"active": True}, {"_id": 0})
    tier_name = "AMBASSADOR VIP" if kind == "vip" else "AMBASSADOR STANDARD"
    now = utcnow().isoformat()
    order = {
        "id": new_id(), "created_at": now, "updated_at": now,
        "event_id": event["id"], "event_name": event["name"],
        "tier_id": "AMBASSADOR_REWARD", "tier_name": tier_name,
        "quantity": 1, "tickets_per_unit": 1, "amount_czk": 0, "list_price_czk": 0,
        "unit_price_czk": 0, "promo_code": None, "discount_percent": None,
        "currency": "CZK", "buyer_name": amb["name"], "buyer_email": amb["email"], "buyer_phone": "",
        "payment_status": "paid", "paid_at": now, "fulfillment_status": "fulfilled",
        "comp": True, "reward": True, "ambassador_id": amb["id"], "created_by": "ambassador-program",
        "marketing_consent": False, "attribution": None, "gopay_payment_id": None,
    }
    await db.orders.insert_one(order)
    code = "ATF-" + secrets.token_hex(3).upper()
    await db.tickets.insert_one({
        "id": new_id(), "code": code, "order_id": order["id"],
        "event_id": event["id"], "event_name": event["name"],
        "tier_id": "AMBASSADOR_REWARD", "tier_name": tier_name,
        "holder_name": amb["name"], "buyer_email": amb["email"],
        "status": "valid", "created_at": now,
        "checked_in_at": None, "checked_in_by": None,
    })
    order_id = order["id"]
    asyncio.create_task(send_ticket_email_with_retry(order["id"]))
    logger.warning("Ambassador reward %s issued to %s (%s) ticket %s", kind, amb["name"], amb["email"], code)
    return {"code": code, "order_id": order_id}


@api_router.post("/admin/ambassadors/{amb_id}/send-reward")
async def admin_ambassador_send_reward(amb_id: str, data: dict, admin=Depends(get_current_admin)):
    amb = await db.ambassadors.find_one({"id": amb_id})
    if not amb:
        raise HTTPException(404, "Ambassador not found")
    state = await ambassador_public_state({k: v for k, v in amb.items() if k != "_id"})
    kind = data.get("type")
    if kind == "standard":
        if not state["std_eligible"]:
            raise HTTPException(400, "Standard reward not eligible (needs 3 paid sales, not yet sent)")
        reward = await _issue_ambassador_reward(amb, "standard")
        await db.ambassadors.update_one({"id": amb_id}, {"$set": {
            "reward_standard": {"sent": True, "at": utcnow().isoformat(), "ticket_code": reward["code"],
                                "order_id": reward["order_id"], "by": admin.get("email")}}})
    elif kind == "vip":
        if not state["vip_eligible"]:
            raise HTTPException(400, "VIP reward not eligible (needs 5 paid sales, not yet sent)")
        if (amb.get("reward_standard") or {}).get("sent"):
            raise HTTPException(400, "Standard reward already sent — use Upgrade to VIP instead")
        reward = await _issue_ambassador_reward(amb, "vip")
        await db.ambassadors.update_one({"id": amb_id}, {"$set": {
            "reward_vip": {"sent": True, "at": utcnow().isoformat(), "ticket_code": reward["code"],
                           "order_id": reward["order_id"], "by": admin.get("email")}}})
    else:
        raise HTTPException(400, "type must be 'standard' or 'vip'")
    logger.warning("ADMIN %s sent %s reward to ambassador %s", admin.get("email"), kind, amb["name"])
    return await ambassador_public_state(await db.ambassadors.find_one({"id": amb_id}, {"_id": 0}))


@api_router.post("/admin/ambassadors/{amb_id}/upgrade-reward")
async def admin_ambassador_upgrade_reward(amb_id: str, admin=Depends(get_current_admin)):
    amb = await db.ambassadors.find_one({"id": amb_id})
    if not amb:
        raise HTTPException(404, "Ambassador not found")
    state = await ambassador_public_state({k: v for k, v in amb.items() if k != "_id"})
    if not state["can_upgrade"]:
        raise HTTPException(400, "Upgrade not available (needs standard sent + 5 paid sales, not yet VIP)")
    std = amb["reward_standard"]
    await db.tickets.update_one({"code": std["ticket_code"]}, {"$set": {"tier_name": "AMBASSADOR VIP"}})
    if std.get("order_id"):
        await db.orders.update_one({"id": std["order_id"]}, {"$set": {"tier_name": "AMBASSADOR VIP"}})
    await db.ambassadors.update_one({"id": amb_id}, {"$set": {
        "reward_vip": {"sent": True, "at": utcnow().isoformat(), "ticket_code": std["ticket_code"],
                       "upgraded": True, "by": admin.get("email")}}})
    logger.warning("ADMIN %s upgraded ambassador %s reward ticket %s to VIP", admin.get("email"), amb["name"], std["ticket_code"])
    return await ambassador_public_state(await db.ambassadors.find_one({"id": amb_id}, {"_id": 0}))


@api_router.post("/admin/ambassadors/{amb_id}/fifty-code")
async def admin_ambassador_fifty_code(amb_id: str, admin=Depends(get_current_admin)):
    amb = await db.ambassadors.find_one({"id": amb_id})
    if not amb:
        raise HTTPException(404, "Ambassador not found")
    state = await ambassador_public_state({k: v for k, v in amb.items() if k != "_id"})
    if not state["fifty_eligible"]:
        raise HTTPException(400, "50% code requires 8/8 stories, fewer than 3 paid sales, within 14 days of activation, and no active code")
    code = "ATF50-" + secrets.token_hex(3).upper()
    await db.ambassadors.update_one({"id": amb_id}, {"$set": {
        "fifty": {"code": code, "redeemed": False, "created_at": utcnow().isoformat(), "by": admin.get("email")}}})
    logger.warning("ADMIN %s created 50%% code %s for ambassador %s", admin.get("email"), code, amb["name"])
    return await ambassador_public_state(await db.ambassadors.find_one({"id": amb_id}, {"_id": 0}))


@api_router.get("/admin/ambassadors/{amb_id}/qr.png")
async def admin_ambassador_qr(amb_id: str, admin=Depends(get_current_admin)):
    amb = await db.ambassadors.find_one({"id": amb_id})
    if not amb:
        raise HTTPException(404, "Ambassador not found")
    img = qrcode.make(f"{SITE_URL}/tickets?ref={amb['code']}", box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png",
                    headers={"Content-Disposition": f"attachment; filename=referral-{amb['code']}.png"})


# ---------------- discount codes admin ----------------

class PromoIn(BaseModel):
    code: Optional[str] = Field(default=None, max_length=24)
    percent_off: Optional[int] = Field(default=None, ge=1, le=100)
    amount_off_czk: Optional[int] = Field(default=None, ge=1, le=5000)
    max_uses: Optional[int] = Field(default=None, ge=1, le=100000)
    active: bool = True
    note: str = Field(default="", max_length=200)


class PromoEditIn(BaseModel):
    percent_off: Optional[int] = Field(default=None, ge=1, le=100)
    amount_off_czk: Optional[int] = Field(default=None, ge=1, le=5000)
    max_uses: Optional[int] = Field(default=None, ge=0, le=100000)  # 0 = unlimited
    active: Optional[bool] = None
    note: Optional[str] = Field(default=None, max_length=200)


async def promo_uses_left(promo: dict) -> Optional[int]:
    """Discounted tickets left on a promo code, or None when the code is unlimited."""
    if not promo.get("max_uses"):
        return None
    return max(0, promo["max_uses"] - await code_tickets_sold(promo["code"]))


async def promo_public_state(p: dict) -> dict:
    used = await code_tickets_sold(p["code"])
    return {
        "code": p["code"],
        "percent_off": p.get("percent_off"),
        "amount_off_czk": p.get("amount_off_czk"),
        "max_uses": p.get("max_uses"),
        "active": bool(p.get("active")),
        "note": p.get("note") or "",
        "created_at": p.get("created_at"),
        "uses": used,
        "uses_left": max(0, p["max_uses"] - used) if p.get("max_uses") else None,
        "orders": await db.orders.count_documents({"promo_code": p["code"], "payment_status": "paid"}),
    }


@api_router.get("/admin/promo-codes")
async def admin_promo_list(admin=Depends(get_current_admin)):
    codes = await db.promo_codes.find({}, {"_id": 0}).to_list(500)
    codes.sort(key=lambda p: p.get("created_at") or "", reverse=True)
    return [await promo_public_state(p) for p in codes]


@api_router.post("/admin/promo-codes")
async def admin_promo_create(data: PromoIn, admin=Depends(get_current_admin)):
    code = (data.code or "").strip().upper() or ("ATF" + secrets.token_hex(3).upper())
    if not re.fullmatch(r"[A-Z0-9-]{3,24}", code):
        raise HTTPException(400, "Code must be 3–24 chars: letters, numbers, dashes")
    if bool(data.percent_off) == bool(data.amount_off_czk):
        raise HTTPException(400, "Set either a percent discount or a fixed CZK amount")
    if await db.promo_codes.find_one({"code": code}) or await db.ambassadors.find_one({"code": code}):
        raise HTTPException(409, "This code is already taken")
    doc = {
        "code": code, "percent_off": data.percent_off, "amount_off_czk": data.amount_off_czk,
        "max_uses": data.max_uses, "active": data.active, "note": data.note.strip(),
        "created_at": utcnow().isoformat(), "created_by": admin.get("email"),
    }
    await db.promo_codes.insert_one(dict(doc))
    logger.warning("ADMIN %s created discount code %s", admin.get("email"), code)
    return await promo_public_state(doc)


@api_router.put("/admin/promo-codes/{code}")
async def admin_promo_edit(code: str, data: PromoEditIn, admin=Depends(get_current_admin)):
    c = code.strip().upper()
    if not await db.promo_codes.find_one({"code": c}):
        raise HTTPException(404, "Code not found")
    upd = data.model_dump(exclude_none=True)
    if not upd:
        raise HTTPException(400, "Nothing to update")
    if upd.get("max_uses") == 0:
        upd["max_uses"] = None
    if upd.get("percent_off"):
        upd["amount_off_czk"] = None
    elif upd.get("amount_off_czk"):
        upd["percent_off"] = None
    await db.promo_codes.update_one({"code": c}, {"$set": upd})
    logger.warning("ADMIN %s edited discount code %s: %s", admin.get("email"), c, list(upd))
    return await promo_public_state(await db.promo_codes.find_one({"code": c}, {"_id": 0}))


@api_router.delete("/admin/promo-codes/{code}")
async def admin_promo_delete(code: str, admin=Depends(get_current_admin)):
    c = code.strip().upper()
    if await code_tickets_sold(c):
        raise HTTPException(400, "This code was already used — deactivate it instead of deleting")
    result = await db.promo_codes.delete_one({"code": c})
    if not result.deleted_count:
        raise HTTPException(404, "Code not found")
    logger.warning("ADMIN %s deleted discount code %s", admin.get("email"), c)
    return {"ok": True}


# ---------------- fulfillment & reconciliation ----------------

async def fulfill_upgrade(order: dict):
    """Paid Standard→VIP upgrade: re-labels the EXISTING ticket to VIP (same QR code).
    Per-tier/category sold counts move automatically because tier_id/tier_name change."""
    code = order.get("upgrade_ticket_code")
    t = await db.tickets.find_one({"code": code})
    if not t:
        logger.error("Upgrade order %s: ticket %s not found", order["id"], code)
        return
    if "VIP" in (t.get("tier_name") or "").upper():
        logger.info("Upgrade order %s: ticket %s already VIP", order["id"], code)
    else:
        await db.tickets.update_one({"id": t["id"]}, {"$set": {
            "tier_id": order["upgrade_vip_tier_id"],
            "tier_name": "VIP Table Ticket",
            "upgraded": True,
            "upgraded_at": utcnow().isoformat(),
            "upgrade_order_id": order["id"],
        }})
        t = await db.tickets.find_one({"id": t["id"]}, {"_id": 0})
        logger.warning("Ticket %s upgraded Standard→VIP via order %s", code, order["id"])
    await send_capi_purchase(order)
    email_order = {**order, "tier_name": "VIP Table Ticket", "quantity": 1}
    try:
        html = build_ticket_email_html(email_order, [t])
        await send_email(to=order["buyer_email"], subject="Asia Takeover — Your ticket is now VIP 🎟️", html=html)
    except Exception as e:
        logger.warning("Upgrade confirmation email failed for order %s: %s", order["id"], str(e)[:150])
    logger.info("Upgrade order %s fulfilled for ticket %s", order["id"], code)


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
    if order.get("kind") == "upgrade":
        await fulfill_upgrade(order)
        return
    if order.get("promo_code"):
        await db.ambassadors.update_one(
            {"fifty.code": order["promo_code"]},
            {"$set": {"fifty.redeemed": True, "fifty.redeemed_at": utcnow().isoformat()}},
        )
    for _ in range(order["quantity"] * order.get("tickets_per_unit", 1)):
        code = "ATF-" + secrets.token_hex(3).upper()
        await db.tickets.insert_one({
            "id": new_id(), "code": code, "order_id": order["id"],
            "event_id": order["event_id"], "event_name": order["event_name"],
            "tier_id": order["tier_id"], "tier_name": order["tier_name"],
            "holder_name": order["buyer_name"], "buyer_email": order["buyer_email"],
            "status": "valid", "created_at": utcnow().isoformat(),
            "checked_in_at": None, "checked_in_by": None,
        })
    if "GOLD" in (order.get("tier_name") or "").upper():
        await db.messages.insert_one({
            "id": new_id(), "topic": "VIP GOLD TABLE",
            "name": order["buyer_name"], "email": order["buyer_email"],
            "phone": order.get("buyer_phone", ""),
            "guests": order["quantity"], "floor": "",
            "message": f"Paid Gold table order {order['id'][:8]} · {order['amount_czk']} CZK",
            "status": "new", "removed": False, "notes": "",
            "order_id": order["id"], "created_at": utcnow().isoformat(),
        })
    await send_capi_purchase(order)
    asyncio.create_task(send_ticket_email_with_retry(order["id"]))
    logger.info("Order %s fulfilled: %d ticket(s) issued", order["id"], order["quantity"])


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


# ---------------- ambassadors ----------------

AMB_DISCOUNT_CZK = 50
AMB_MAX_USES = 10
FIFTY_WINDOW_DAYS = 14


async def code_tickets_sold(code: str) -> int:
    """Paid, non-refunded tickets bought with this discount code (each ticket = 1 use)."""
    orders = await db.orders.find(
        {"promo_code": code.strip().upper(), "payment_status": "paid"},
        {"_id": 0, "quantity": 1, "tickets_per_unit": 1},
    ).to_list(100000)
    return sum(o["quantity"] * o.get("tickets_per_unit", 1) for o in orders)


async def ambassador_sales(code: str) -> int:
    return await code_tickets_sold(code)


async def ambassador_public_state(amb: dict) -> dict:
    sales = await ambassador_sales(amb["code"])
    std = amb.get("reward_standard") or {}
    vip = amb.get("reward_vip") or {}
    fifty = amb.get("fifty") or {}
    activated = datetime.fromisoformat(amb.get("activated_at") or amb["created_at"])
    fifty_window_open = datetime.now(timezone.utc) <= activated + timedelta(days=FIFTY_WINDOW_DAYS)
    return {
        **{k: v for k, v in amb.items() if k != "_id"},
        "sales": sales,
        "discount_czk": amb.get("discount_czk", AMB_DISCOUNT_CZK),
        "uses_left": max(0, AMB_MAX_USES - sales),
        "std_eligible": sales >= 3 and not std.get("sent"),
        "vip_eligible": sales >= 5 and not vip.get("sent"),
        "can_upgrade": sales >= 5 and bool(std.get("sent")) and not vip.get("sent"),
        "fifty_eligible": amb.get("stories_shared", 0) >= 8 and sales < 3 and fifty_window_open and not fifty,
        "referral_url": f"{SITE_URL}/tickets?ref={amb['code']}",
    }


# ---------------- order endpoints ----------------

_rate_hits = {}


def rate_limit(ip: str, limit: int = 10, window: int = 300):
    now = time.time()
    hits = [t for t in _rate_hits.get(ip, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "Too many requests. Try again later.")
    hits.append(now)
    _rate_hits[ip] = hits


@api_router.get("/promo/validate")
async def promo_validate(code: str):
    c = code.strip().upper()
    promo = await db.promo_codes.find_one({"code": c, "active": True})
    if promo:
        left = await promo_uses_left(promo)
        if left == 0:
            return {"valid": False, "reason": "This code has no discounted tickets left"}
        out = {"valid": True}
        if promo.get("amount_off_czk"):
            out["amount_off_czk"] = promo["amount_off_czk"]
        else:
            out["percent_off"] = promo.get("percent_off") or 0
        if left is not None:
            out["uses_left"] = left
        return out
    amb = await db.ambassadors.find_one({"code": c, "active": True})
    if amb:
        sales = await ambassador_sales(c)
        left = max(0, AMB_MAX_USES - sales)
        if left <= 0:
            return {"valid": False, "reason": "This code has no discounted tickets left"}
        return {"valid": True, "amount_off_czk": amb.get("discount_czk", AMB_DISCOUNT_CZK), "uses_left": left, "ambassador": amb["name"]}
    amb2 = await db.ambassadors.find_one({"fifty.code": c, "active": True})
    if amb2:
        if amb2["fifty"].get("redeemed"):
            return {"valid": False, "reason": "Code already redeemed"}
        return {"valid": True, "percent_off": 50, "max_qty": 1, "ambassador": amb2["name"]}
    return {"valid": False}


def client_ip(request: Request) -> str:
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "unknown")


async def active_event() -> dict:
    event = await db.events.find_one({"active": True}, {"_id": 0})
    if not event:
        raise HTTPException(404, "No active event")
    return event


async def assert_ga_release_on_sale(event_id: str, tier: dict) -> None:
    """Sequential GA releases: only the first release with free capacity is purchasable."""
    tiers = await db.ticket_tiers.find({"event_id": event_id}).to_list(100)
    ga = sorted((t for t in tiers if "VIP" not in t["name"].upper() and "GROUP" not in t["name"].upper()),
                key=lambda t: t["price_czk"])
    for t in ga:
        if await db.tickets.count_documents({"tier_id": t["id"]}) < t["capacity"]:
            if tier["id"] != t["id"]:
                raise HTTPException(400, "This release is not on sale yet")
            return
    raise HTTPException(400, "All releases are sold out")


async def assert_tier_capacity(tier: dict, quantity: int, tickets_per_unit: int, is_gold: bool) -> None:
    if is_gold:
        if not (4 <= quantity <= 14):
            raise HTTPException(400, "Gold table requires 4–14 guests")
        tables_sold = await db.orders.count_documents({"tier_id": tier["id"], "payment_status": "paid"})
        if tables_sold >= tier["capacity"]:
            raise HTTPException(400, "Sold out")
        return
    sold = await db.tickets.count_documents({"tier_id": tier["id"]})
    if sold + quantity * tickets_per_unit > tier["capacity"]:
        raise HTTPException(400, "Not enough tickets left in this tier")


async def apply_discount_code(code: str, unit_price: int, quantity: int, restricted: bool):
    """Resolve promo / ambassador / ambassador-50% codes. Returns (unit_price, discount_percent, code_used).
    `restricted` = GROUP/GOLD tiers where ambassador codes are not accepted."""
    c = code.strip().upper()
    promo = await db.promo_codes.find_one({"code": c, "active": True})
    if promo:
        left = await promo_uses_left(promo)
        if left is not None:
            if left <= 0:
                raise HTTPException(400, "This code has no discounted tickets left")
            if quantity > left:
                raise HTTPException(400, f"This code has only {left} discounted ticket(s) left")
        if promo.get("amount_off_czk"):
            return max(1, unit_price - promo["amount_off_czk"]), None, c
        pct = promo.get("percent_off") or 0
        return max(1, round(unit_price * (100 - pct) / 100)), pct, c
    amb = await db.ambassadors.find_one({"code": c, "active": True})
    if amb:
        if restricted:
            raise HTTPException(400, "This code is valid for Standard and VIP Table tickets only")
        left = AMB_MAX_USES - await ambassador_sales(c)
        if left <= 0:
            raise HTTPException(400, "This code has no discounted tickets left")
        if quantity > left:
            raise HTTPException(400, f"This code has only {left} discounted ticket(s) left")
        return max(1, unit_price - amb.get("discount_czk", AMB_DISCOUNT_CZK)), None, c
    amb2 = await db.ambassadors.find_one({"fifty.code": c, "active": True})
    if amb2 and not amb2["fifty"].get("redeemed"):
        if restricted:
            raise HTTPException(400, "This code is valid for Standard and VIP Table tickets only")
        if quantity > 1:
            raise HTTPException(400, "This code is valid for one ticket only")
        return max(1, round(unit_price / 2)), 50, c
    raise HTTPException(400, "Invalid discount code")


def new_order_doc(*, event: dict, tier_id: str, tier_name: str, quantity: int, tickets_per_unit: int,
                  amount: int, list_price: int, unit_price: int, buyer_name: str, buyer_email: str,
                  buyer_phone: str, request: Request, **extra) -> dict:
    now = utcnow().isoformat()
    return {
        "id": new_id(),
        "created_at": now,
        "updated_at": now,
        "event_id": event["id"],
        "event_name": event["name"],
        "tier_id": tier_id,
        "tier_name": tier_name,
        "quantity": quantity,
        "tickets_per_unit": tickets_per_unit,
        "amount_czk": amount,
        "list_price_czk": list_price,
        "unit_price_czk": unit_price,
        "promo_code": None,
        "discount_percent": None,
        "currency": "CZK",
        "buyer_name": buyer_name,
        "buyer_email": buyer_email.lower(),
        "buyer_phone": buyer_phone.strip(),
        "payment_status": "created",
        "gopay_payment_id": None,
        "paid_at": None,
        "fulfillment_status": "pending",
        "marketing_consent": False,
        "attribution": None,
        "client_ip": client_ip(request),
        "user_agent": request.headers.get("user-agent"),
        **extra,
    }


async def create_payment_and_store(order: dict) -> dict:
    """Opens the provider payment (Teya → GoPay → guarded simulation), persists the order, returns the checkout response."""
    if teya_configured():
        s = await teya_create_session(order)
        order.update(teya_session_id=str(s["session_id"]), payment_provider="teya", teya_session_token=s["session_token"])
        payment_url, mode = s["session_url"], "teya"
    elif gopay_configured():
        p = await gopay_create_payment(order)
        order["gopay_payment_id"] = str(p["id"])
        payment_url, mode = p["gw_url"], "gopay"
    elif payment_sim_allowed():
        pid = f"SIM-{order['id']}"
        order["gopay_payment_id"] = pid
        payment_url, mode = f"/pay/{order['id']}", "simulation"
        await db.sim_payments.insert_one({"id": pid, "state": "CREATED", "order_id": order["id"]})
    else:
        raise HTTPException(503, "Online payments are temporarily unavailable")
    await db.orders.insert_one(order)
    return {
        "order_id": order["id"],
        "payment_url": payment_url,
        "mode": mode,
        "amount_czk": order["amount_czk"],
        "currency": "CZK",
        "session_token": order.get("teya_session_token"),
    }


@api_router.post("/orders/create")
async def create_order(data: OrderCreateIn, request: Request):
    rate_limit(client_ip(request))
    event = await active_event()
    tier = await db.ticket_tiers.find_one({"id": data.tier_id}, {"_id": 0})
    if not tier or tier["event_id"] != event["id"]:
        raise HTTPException(404, "Ticket tier not found")
    upper = tier["name"].upper()
    is_group, is_gold = "GROUP" in upper, "GOLD" in upper
    tickets_per_unit = 4 if is_group else 1
    if "VIP" not in upper and not is_group:
        await assert_ga_release_on_sale(event["id"], tier)
    await assert_tier_capacity(tier, data.quantity, tickets_per_unit, is_gold)
    unit_price, discount_percent, promo_code_used = tier["price_czk"], None, None
    if data.promo_code:
        if is_gold:
            raise HTTPException(400, "Discount codes cannot be used for the Gold Table")
        unit_price, discount_percent, promo_code_used = await apply_discount_code(
            data.promo_code, unit_price, data.quantity, restricted=is_group or is_gold)
    if is_gold:
        amount = 3999 + 899 * data.quantity
        unit_price = round(amount / data.quantity)
    else:
        amount = unit_price * data.quantity
    order = new_order_doc(
        event=event, tier_id=tier["id"], tier_name=ticket_display_name(tier["name"]),
        quantity=data.quantity, tickets_per_unit=tickets_per_unit, amount=amount,
        list_price=0 if is_gold else tier["price_czk"], unit_price=unit_price,
        buyer_name=data.name, buyer_email=data.email, buyer_phone=data.phone, request=request,
        promo_code=promo_code_used, discount_percent=discount_percent,
        marketing_consent=data.marketing_consent,
        attribution=data.attribution.model_dump() if data.attribution else None,
    )
    return await create_payment_and_store(order)


# ---------------- ticket upgrade (Standard → VIP) ----------------

UPGRADE_PRICE_CZK = 400


class UpgradeCheckIn(BaseModel):
    code: str


async def upgradeable_ticket(code: str) -> dict:
    t = await find_ticket(code)
    if not t:
        raise HTTPException(404, "Ticket not found — check the code")
    ost = await order_status_for(t)
    if t["status"] == "refunded" or ost in ("refunded", "partially_refunded"):
        raise HTTPException(400, "This ticket was refunded")
    if "VIP" in (t.get("tier_name") or "").upper() or t.get("guest_list"):
        raise HTTPException(400, "This ticket is already VIP")
    if t["status"] == "used":
        raise HTTPException(400, "This ticket was already checked in")
    return t


@api_router.post("/upgrade/check")
async def upgrade_check(data: UpgradeCheckIn):
    t = await upgradeable_ticket(data.code)
    return {"valid": True, "code": t["code"], "tier_name": t["tier_name"],
            "holder_name": t.get("holder_name"), "price_czk": UPGRADE_PRICE_CZK}


class UpgradeCreateIn(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=6, max_length=30)


async def current_vip_tier(event_id: str) -> dict:
    tiers = await db.ticket_tiers.find({"event_id": event_id}).to_list(100)
    vip = [x for x in tiers if "VIP" in x["name"].upper() and "GOLD" not in x["name"].upper()]
    if not vip:
        raise HTTPException(400, "No VIP tier exists")
    vip.sort(key=lambda x: x["price_czk"])
    for x in vip:
        if await db.tickets.count_documents({"tier_id": x["id"]}) < x["capacity"]:
            return x
    return vip[-1]


@api_router.post("/upgrade/create")
async def upgrade_create(data: UpgradeCreateIn, request: Request):
    rate_limit(client_ip(request))
    t = await upgradeable_ticket(data.code)
    event = await active_event()
    vip_tier = await current_vip_tier(event["id"])
    order = new_order_doc(
        event=event, tier_id=vip_tier["id"], tier_name="VIP Upgrade", quantity=1, tickets_per_unit=1,
        amount=UPGRADE_PRICE_CZK, list_price=UPGRADE_PRICE_CZK, unit_price=UPGRADE_PRICE_CZK,
        buyer_name=data.name.strip(), buyer_email=data.email, buyer_phone=data.phone, request=request,
        kind="upgrade", upgrade_ticket_code=t["code"], upgrade_vip_tier_id=vip_tier["id"],
    )
    resp = await create_payment_and_store(order)
    logger.warning("Upgrade order %s created for ticket %s (%s)", order["id"], t["code"], order["buyer_email"])
    return resp


@api_router.get("/orders/{order_id}/status")
async def order_status(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if (order.get("teya_session_id") and teya_configured()
            and order.get("payment_status") in (None, "created", "pending")):
        try:
            await teya_reconcile(order["teya_session_id"])
            order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        except Exception as e:
            logger.warning("Teya sync for order %s failed: %s", order_id, str(e)[:150])
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
    if order.get("kind") == "upgrade":
        t = await db.tickets.find_one({"code": order.get("upgrade_ticket_code")}, {"_id": 0})
        tickets = [t] if t else []
    else:
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

def _teya_signature_ok(raw: bytes, sig: str) -> bool:
    import textwrap
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
    try:
        b64 = "".join(TEYA_WEBHOOK_PUBLIC_KEY.split())
        if "BEGIN PUBLIC KEY" not in b64:
            b64 = "-----BEGIN PUBLIC KEY-----\n" + "\n".join(textwrap.wrap(b64, 64)) + "\n-----END PUBLIC KEY-----\n"
        pk = serialization.load_pem_public_key(b64.encode())
        pk.verify(base64.b64decode(sig), raw, asym_padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception:
        return False


def _teya_event_session_id(event: dict):
    data = event.get("data", event)
    return data.get("session_id") or data.get("checkout_session_id") or data.get("id")


@api_router.post("/payments/teya/notify")
async def teya_notification(request: Request):
    raw = await request.body()
    if TEYA_WEBHOOK_PUBLIC_KEY:
        sig = request.headers.get("X-Teya-Signature", "")
        if not _teya_signature_ok(raw, sig):
            # Never reject: the payload is NOT trusted anyway — we only use it as a trigger
            # and re-fetch the authoritative session state from Teya server-to-server below
            # (teya_reconcile verifies merchant_reference + amount + currency against our DB).
            logger.warning("Teya webhook signature check failed (sig len %d) — reconciling server-side anyway", len(sig))
    try:
        event = json.loads(raw)
    except Exception:
        raise HTTPException(400, "Bad payload")
    event_id = event.get("id") or event.get("event_id")
    if event_id and await db.meta_events.find_one({"event_id": f"teya_{event_id}"}):
        return {"ok": True}
    sid = _teya_event_session_id(event)
    if sid:
        try:
            await teya_reconcile(sid)
        except HTTPException as e:
            if e.status_code != 404:
                raise HTTPException(502, "Reconciliation failed")
        except Exception:
            raise HTTPException(502, "Reconciliation failed")
    if event_id:
        await db.meta_events.insert_one({"event_id": f"teya_{event_id}", "received_at": utcnow().isoformat()})
    return {"ok": True}




class SimActionIn(BaseModel):
    order_id: str
    action: str = ""


@api_router.post("/payments/sim/action")
async def sim_action(data: SimActionIn):
    if gopay_configured() or not payment_sim_allowed():
        raise HTTPException(404, "Not available")
    state = {"paid": "PAID", "failed": "CANCELED", "cancelled": "CANCELED",
             "timeout": "TIMEOUTED", "refunded": "REFUNDED"}.get(data.action)
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


class GateIn(BaseModel):
    password: str


@api_router.post("/gate")
async def gate(data: GateIn):
    pw = os.environ.get("LOCKDOWN_PASSWORD", "")
    if pw and data.password == pw:
        return {"ok": True}
    raise HTTPException(401, "Wrong password")


@api_router.get("/gate/status")
async def gate_status():
    doc = await db.settings.find_one({"key": "lockdown"}, {"_id": 0})
    doc = doc or {}
    return {"enabled": doc.get("enabled", True), "since": doc.get("since", 0)}


class LockdownIn(BaseModel):
    enabled: bool


@api_router.put("/admin/lockdown")
async def set_lockdown(data: LockdownIn, admin=Depends(get_current_admin)):
    doc = {"key": "lockdown", "enabled": data.enabled}
    if data.enabled:
        doc["since"] = int(time.time() * 1000)
    await db.settings.update_one({"key": "lockdown"}, {"$set": doc}, upsert=True)
    return {"enabled": data.enabled, "since": doc.get("since")}


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    topic: str = "general"
    message: str = Field(min_length=1, max_length=4000)


@api_router.post("/contact")
async def contact(data: ContactIn):
    doc = {"id": new_id(), **data.model_dump(), "status": "new", "removed": False, "created_at": utcnow().isoformat()}
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


class ReservationIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=30)
    email: EmailStr
    guests: int = Field(ge=1, le=30)
    floor: str = Field(min_length=1, max_length=60)
    message: str = Field(default="", max_length=4000)


@api_router.post("/reservations")
async def create_reservation(data: ReservationIn):
    if "mainstream" in (data.floor or "").lower():
        raise HTTPException(400, "This floor is not available for VIP table reservations")
    doc = {"id": new_id(), "topic": "VIP Table Reservation", **data.model_dump(), "status": "new", "removed": False, "created_at": utcnow().isoformat()}
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "id": doc["id"]}


# ---------------- scanner (door staff) ----------------

class ScanIn(BaseModel):
    code: str


def normalize_code(code: str) -> str:
    clean = (code or "").strip().upper()
    if "ATF-" in clean:
        clean = clean[clean.index("ATF-"):]
    return clean


async def find_ticket(code: str):
    return await db.tickets.find_one({"code": normalize_code(code)}, {"_id": 0})


async def order_status_for(ticket: dict) -> str:
    order = await db.orders.find_one({"id": ticket["order_id"]}, {"_id": 0})
    if not order:
        return "paid_mock"
    return order.get("payment_status") or order.get("status", "paid_mock")


async def ticket_admission(ticket: dict) -> dict:
    """What the door must hand out: wristband type + surprise gift.
    Gift only for VIP tickets that were really paid for (presale, incl. discount codes and upgrades).
    Guest list, ambassador rewards and door comps get a VIP wristband but NO gift."""
    is_vip = "VIP" in (ticket.get("tier_name") or "").upper()
    gift = False
    if is_vip and not ticket.get("guest_list"):
        order = await db.orders.find_one({"id": ticket.get("order_id")}, {"_id": 0, "comp": 1, "amount_czk": 1})
        gift = bool(order) and not order.get("comp") and (order.get("amount_czk") or 0) > 0
    return {"wristband": "vip" if is_vip else "standard", "gift": gift}


def decline_reason(order_status: str) -> str:
    if order_status in ("refunded", "partially_refunded"):
        return "REFUNDED"
    if order_status == "cancelled":
        return "CANCELLED"
    return "UNPAID"


@api_router.post("/scan/lookup")
async def scan_lookup(data: ScanIn, admin=Depends(get_current_admin)):
    t = await find_ticket(data.code)
    if not t:
        return {"result": "invalid", "reason": "INVALID", "ticket": None}
    order_status = await order_status_for(t)
    if t["status"] == "refunded" or order_status in ("refunded", "partially_refunded"):
        return {"result": "refunded", "reason": "REFUNDED", "ticket": t}
    if order_status not in ("paid", "paid_mock"):
        return {"result": "invalid", "reason": decline_reason(order_status), "ticket": t}
    return {"result": t["status"], "reason": None if t["status"] == "valid" else "ALREADY USED",
            "ticket": t, "admission": await ticket_admission(t)}


@api_router.post("/scan/checkin")
async def scan_checkin(data: ScanIn, admin=Depends(get_current_admin)):
    code = normalize_code(data.code)
    ts = utcnow().isoformat()
    t = await db.tickets.find_one_and_update(
        {"code": code, "status": "valid"},
        {"$set": {"status": "used", "checked_in_at": ts,
                  "checked_in_by": admin.get("email")}},
        return_document=ReturnDocument.AFTER,
    )
    if t:
        t.pop("_id", None)
        order_status = await order_status_for(t)
        if order_status in ("refunded", "partially_refunded"):
            await db.tickets.update_one({"id": t["id"]}, {"$set": {"status": "refunded"}})
            t["status"] = "refunded"
            return {"result": "refunded", "reason": "REFUNDED", "ticket": t}
        if order_status not in ("paid", "paid_mock"):
            # never burn a ticket whose order is not paid — put it back as valid
            await db.tickets.update_one(
                {"id": t["id"]},
                {"$set": {"status": "valid", "checked_in_at": None, "checked_in_by": None}},
            )
            t.update(status="valid", checked_in_at=None, checked_in_by=None)
            return {"result": "invalid", "reason": decline_reason(order_status), "ticket": t}
        return {"result": "valid", "reason": None, "ticket": t, "admission": await ticket_admission(t)}
    existing = await db.tickets.find_one({"code": code}, {"_id": 0})
    if not existing:
        return {"result": "invalid", "reason": "INVALID", "ticket": None}
    if existing["status"] == "refunded":
        return {"result": "refunded", "reason": "REFUNDED", "ticket": existing}
    return {"result": "used", "reason": "ALREADY USED", "ticket": existing,
            "admission": await ticket_admission(existing)}


# ---------------- admin ----------------

def is_paid(order: dict) -> bool:
    return (order.get("payment_status") or "paid_mock") in ("paid", "paid_mock")


def order_ticket_count(order: dict) -> int:
    return order["quantity"] * order.get("tickets_per_unit", 1)


def revenue_check_stats(paid_orders: list, tier_price: dict) -> dict:
    def list_value(o):
        if o.get("tier_name") == "VIP GOLD":
            return o["amount_czk"]  # per-table pricing, no list math
        return (o.get("list_price_czk") or o["amount_czk"]) * o["quantity"]

    comps = [o for o in paid_orders if o.get("comp") and not o.get("guest_list")]
    return {
        "list_total_czk": sum(list_value(o) for o in paid_orders),
        "comp_tickets": sum(order_ticket_count(o) for o in comps),
        "comp_nominal_czk": sum(order_ticket_count(o) * tier_price.get(o["tier_id"], 0) for o in comps),
        "promo_discount_czk": sum(
            max(0, (o.get("list_price_czk") or 0) * o["quantity"] - o["amount_czk"])
            for o in paid_orders if o.get("promo_code")
        ),
    }


async def per_tier_stats(tiers: list, paid_orders: list) -> list:
    revenue_by_tier = {}
    for o in paid_orders:
        revenue_by_tier[o["tier_id"]] = revenue_by_tier.get(o["tier_id"], 0) + o["amount_czk"]
    out = []
    for t in tiers:
        sold = await db.tickets.count_documents({"tier_id": t["id"]})
        out.append({"name": t["name"], "sold": sold, "capacity": t["capacity"],
                    "revenue": revenue_by_tier.get(t["id"], 0)})
    return out


async def _sold_and_checked(query: dict) -> dict:
    return {"sold": await db.tickets.count_documents(query),
            "checked_in": await db.tickets.count_documents({**query, "status": "used"})}


async def _guest_stats(tier_name: str) -> dict:
    s = await _sold_and_checked({"guest_list": True, "tier_name": tier_name})
    return {"sent": s["sold"], "checked_in": s["checked_in"]}


async def category_stats() -> dict:
    return {
        "standard": await _sold_and_checked({"tier_name": "Standard Ticket", "guest_list": {"$ne": True}}),
        "vip": await _sold_and_checked({"tier_name": "VIP Table Ticket"}),
        "vip_guest_list": await _guest_stats("VIP Guest List"),
        "standard_guest_list": await _guest_stats("Standard Guest List"),
    }


async def ambassadors_overview() -> dict:
    ov = {"active": 0, "total_sales": 0, "std_eligible": 0, "std_sent": 0,
          "vip_eligible": 0, "vip_sent": 0, "fifty_eligible": 0, "fifty_redeemed": 0}
    for a in await db.ambassadors.find({}, {"_id": 0}).to_list(500):
        st = await ambassador_public_state(a)
        ov["active"] += bool(a.get("active"))
        ov["total_sales"] += st["sales"]
        ov["std_eligible"] += bool(st["std_eligible"])
        ov["std_sent"] += bool((a.get("reward_standard") or {}).get("sent"))
        ov["vip_eligible"] += bool(st["vip_eligible"])
        ov["vip_sent"] += bool((a.get("reward_vip") or {}).get("sent"))
        ov["fifty_eligible"] += bool(st["fifty_eligible"])
        ov["fifty_redeemed"] += bool((a.get("fifty") or {}).get("redeemed"))
    return ov


@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(get_current_admin)):
    orders = await db.orders.find({}, {"_id": 0}).to_list(100000)
    tiers = await db.ticket_tiers.find({}, {"_id": 0}).to_list(100)
    paid_orders = [o for o in orders if is_paid(o)]
    tier_price = {t["id"]: t["price_czk"] for t in tiers}
    return {
        "revenue_czk": sum(o["amount_czk"] for o in paid_orders),
        "orders": len(paid_orders),
        # "Tickets sold" = every QR ticket ever generated (paid, guest list, ambassador rewards, comps)
        "tickets_sold": await db.tickets.count_documents({}),
        "checked_in": await db.tickets.count_documents({"status": "used"}),
        "per_tier": await per_tier_stats(tiers, paid_orders),
        "recent_scans": await db.tickets.find({"status": "used"}, {"_id": 0}).sort("checked_in_at", -1).to_list(20),
        "categories": await category_stats(),
        "guest_tickets": await db.tickets.find(
            {"guest_list": True},
            {"_id": 0, "code": 1, "buyer_email": 1, "created_at": 1, "status": 1, "tier_name": 1},
        ).sort("created_at", -1).to_list(1000),
        "ambassadors": await ambassadors_overview(),
        "revenue_check": revenue_check_stats(paid_orders, tier_price),
    }


@api_router.get("/admin/sales-overview")
async def admin_sales_overview(admin=Depends(get_current_admin)):
    """Read-only sales rows from successfully paid orders only (free comps / guest list excluded).
    The admin UI aggregates these per day / category — nothing here writes or changes data."""
    orders = await db.orders.find(
        {},
        {"_id": 0, "created_at": 1, "paid_at": 1, "tier_name": 1, "quantity": 1, "payment_status": 1,
         "tickets_per_unit": 1, "amount_czk": 1, "comp": 1, "guest_list": 1, "kind": 1},
    ).to_list(100000)
    rows = []
    for o in orders:
        if not is_paid(o) or o.get("comp") or o.get("guest_list") or o.get("amount_czk", 0) <= 0:
            continue
        upper = (o.get("tier_name") or "").upper()
        rows.append({
            "date": (o.get("paid_at") or o["created_at"])[:10],
            "category": "vip" if "VIP" in upper else "standard",
            # a paid upgrade adds revenue but no new QR ticket
            "tickets": 0 if o.get("kind") == "upgrade" else o["quantity"] * o.get("tickets_per_unit", 1),
            "revenue": o["amount_czk"],
        })
    rows.sort(key=lambda r: r["date"])
    return {"today": utcnow().date().isoformat(), "rows": rows}


@api_router.get("/admin/checkin-report")
async def admin_checkin_report(admin=Depends(get_current_admin)):
    """Read-only door report: how many tickets exist per type and how many were really scanned in."""
    rows = await db.tickets.aggregate([
        {"$group": {"_id": "$tier_name", "sold": {"$sum": 1},
                    "checked_in": {"$sum": {"$cond": [{"$eq": ["$status", "used"]}, 1, 0]}}}},
        {"$sort": {"sold": -1}},
    ]).to_list(200)
    scans = await db.tickets.find(
        {"status": "used"},
        {"_id": 0, "code": 1, "tier_name": 1, "holder_name": 1, "buyer_email": 1,
         "checked_in_at": 1, "checked_in_by": 1},
    ).sort("checked_in_at", -1).to_list(5000)
    return {
        "total_tickets": sum(r["sold"] for r in rows),
        "checked_in": sum(r["checked_in"] for r in rows),
        "by_tier": [{"tier_name": r["_id"] or "—", "sold": r["sold"], "checked_in": r["checked_in"]}
                    for r in rows],
        "scans": scans,
    }


@api_router.post("/admin/tickets/{code}/reset-checkin")
async def admin_reset_checkin(code: str, admin=Depends(get_current_admin)):
    """Undo an accidental check-in: ticket becomes valid again. Order/payment untouched."""
    c = normalize_code(code)
    t = await db.tickets.find_one({"code": c})
    if not t:
        raise HTTPException(404, "Ticket not found")
    if t.get("status") != "used":
        raise HTTPException(400, "Ticket is not checked in")
    await db.tickets.update_one(
        {"code": c},
        {"$set": {"status": "valid", "checked_in_at": None, "checked_in_by": None}},
    )
    logger.warning("ADMIN %s reset check-in for ticket %s", admin.get("email"), c)
    return {"ok": True, "code": c, "status": "valid"}



GUEST_TIERS = {
    "vip": ("VIP_GUEST_LIST", "VIP Guest List", "VIP Guest"),
    "standard": ("STANDARD_GUEST_LIST", "Standard Guest List", "Guest"),
}


class GuestListIn(BaseModel):
    email: EmailStr
    quantity: int = Field(default=1, ge=1, le=20)
    category: str = "vip"  # "standard" | "vip"


class VipGuestIn(BaseModel):
    email: EmailStr


@api_router.post("/admin/guest-list")
async def admin_guest_list(data: GuestListIn, admin=Depends(get_current_admin)):
    """Issue free Standard/VIP guest-list tickets. 1 ticket = 1 unique single-use QR;
    quantity N creates N separate tickets that go out in one email, each QR listed separately.
    Guest tickets are excluded from revenue and paid-sales stats. No surprise gift at the door."""
    cat = data.category.strip().lower()
    if cat not in GUEST_TIERS:
        raise HTTPException(400, "Category must be 'standard' or 'vip'")
    tier_id, tier_name, holder = GUEST_TIERS[cat]
    event = await db.events.find_one({"active": True}, {"_id": 0})
    if not event:
        raise HTTPException(404, "No active event")
    email = data.email.lower()
    now = utcnow().isoformat()
    order = {
        "id": new_id(), "created_at": now, "updated_at": now,
        "event_id": event["id"], "event_name": event["name"],
        "tier_id": tier_id, "tier_name": tier_name,
        "quantity": data.quantity, "tickets_per_unit": 1, "amount_czk": 0, "list_price_czk": 0,
        "unit_price_czk": 0, "promo_code": None, "discount_percent": None,
        "currency": "CZK", "buyer_name": holder, "buyer_email": email, "buyer_phone": "",
        "payment_status": "paid", "paid_at": now, "fulfillment_status": "fulfilled",
        "comp": True, "guest_list": True, "guest_category": cat, "created_by": admin.get("email"),
        "marketing_consent": False, "attribution": None, "gopay_payment_id": None,
    }
    await db.orders.insert_one(dict(order))
    codes = []
    for _ in range(data.quantity):
        code = "ATF-" + secrets.token_hex(3).upper()
        await db.tickets.insert_one({
            "id": new_id(), "code": code, "order_id": order["id"],
            "event_id": event["id"], "event_name": event["name"],
            "tier_id": tier_id, "tier_name": tier_name,
            "holder_name": holder, "buyer_email": email,
            "guest_list": True, "guest_category": cat,
            "status": "valid", "created_at": now,
            "checked_in_at": None, "checked_in_by": None,
        })
        codes.append(code)
    asyncio.create_task(send_ticket_email_with_retry(order["id"]))
    logger.warning("ADMIN %s sent %d %s guest list ticket(s) to %s",
                   admin.get("email"), data.quantity, cat, email)
    return {"ok": True, "category": cat, "quantity": data.quantity, "codes": codes, "email": email}


@api_router.post("/admin/vip-guest-list")
async def admin_vip_guest_list(data: VipGuestIn, admin=Depends(get_current_admin)):
    r = await admin_guest_list(GuestListIn(email=data.email, quantity=1, category="vip"), admin)
    return {"ok": True, "code": r["codes"][0], "email": r["email"]}


class CompTicketIn(BaseModel):
    quantity: int = Field(default=1, ge=1, le=10)
    holder_name: str = Field(default="Guest", max_length=120)
    category: str = "standard"  # "standard" | "vip"


@api_router.post("/admin/comp-tickets")
async def admin_comp_tickets(data: CompTicketIn, admin=Depends(get_current_admin)):
    """Issue free (comp) tickets manually — e.g. for guests/partners. No payment, no email."""
    event = await db.events.find_one({"active": True}, {"_id": 0})
    if not event:
        raise HTTPException(404, "No active event")
    want_vip = data.category.strip().lower() == "vip"
    tiers = await db.ticket_tiers.find({"event_id": event["id"]}).to_list(100)
    tiers = [t for t in tiers if ("VIP" in t["name"].upper()) == want_vip]
    tiers.sort(key=lambda t: t["price_czk"])
    tier = None
    for t in tiers:
        if await db.tickets.count_documents({"tier_id": t["id"]}) < t["capacity"]:
            tier = t
            break
    if not tier:
        raise HTTPException(400, "No capacity left in this ticket category")
    now = utcnow().isoformat()
    order = {
        "id": new_id(), "created_at": now, "updated_at": now,
        "event_id": event["id"], "event_name": event["name"],
        "tier_id": tier["id"], "tier_name": ticket_display_name(tier["name"]),
        "quantity": data.quantity, "amount_czk": 0, "list_price_czk": 0,
        "unit_price_czk": 0, "promo_code": None, "discount_percent": None,
        "currency": "CZK", "buyer_name": data.holder_name.strip() or "Guest",
        "buyer_email": "", "buyer_phone": "",
        "payment_status": "paid", "paid_at": now, "fulfillment_status": "fulfilled",
        "comp": True, "created_by": admin.get("email"),
        "marketing_consent": False, "attribution": None, "gopay_payment_id": None,
    }
    await db.orders.insert_one(order)
    tickets = []
    for _ in range(data.quantity):
        code = "ATF-" + secrets.token_hex(3).upper()
        t = {
            "id": new_id(), "code": code, "order_id": order["id"],
            "event_id": event["id"], "event_name": event["name"],
            "tier_id": tier["id"], "tier_name": order["tier_name"],
            "holder_name": order["buyer_name"], "buyer_email": "",
            "status": "valid", "created_at": now,
            "checked_in_at": None, "checked_in_by": None,
        }
        await db.tickets.insert_one(t)
        tickets.append(t)
    logger.warning("ADMIN %s issued %d comp ticket(s), tier %s", admin.get("email"), data.quantity, tier["name"])
    return {
        "ok": True, "order_id": order["id"], "tier_name": order["tier_name"],
        "tickets": [{"code": t["code"], "qr_url": f"{SITE_URL}/api/qr/{t['code']}.png",
                      "link": f"{SITE_URL}/success?order_id={order['id']}"} for t in tickets],
    }


@api_router.get("/admin/orders")
async def admin_orders(include_unpaid: bool = False, admin=Depends(get_current_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(10000)
    # one ticket query for all orders — per-order lookups made this endpoint take ~30 s in production
    by_order = {}
    for t in await db.tickets.find({}, {"_id": 0, "order_id": 1, "code": 1, "status": 1}).to_list(100000):
        by_order.setdefault(t.get("order_id"), []).append({"code": t["code"], "status": t.get("status")})
    visible = []
    for o in orders:
        o["tickets"] = by_order.get(o["id"], [])
        o["payment_status"] = o.get("payment_status") or o.get("status", "paid_mock")
        if include_unpaid or o["payment_status"] not in ("created", "pending"):
            visible.append(o)
    return visible


@api_router.post("/admin/orders/{order_id}/sync-payment")
async def admin_sync_payment(order_id: str, admin=Depends(get_current_admin)):
    """Manually re-check a Teya session and reconcile the order (fulfills if the payment succeeded)."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if not order.get("teya_session_id"):
        raise HTTPException(400, "Order has no Teya session to sync")
    status = await teya_reconcile(order["teya_session_id"])
    logger.warning("ADMIN %s synced payment for order %s -> %s", admin.get("email"), order_id, status)
    return {"ok": True, "payment_status": status,
            "tickets": await db.tickets.count_documents({"order_id": order_id})}


@api_router.delete("/admin/orders/{order_id}")
async def admin_delete_order(order_id: str, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(404, "Order not found")
    t = await db.tickets.delete_many({"order_id": order_id})
    await db.sim_payments.delete_many({"order_id": order_id})
    await db.orders.delete_one({"id": order_id})
    logger.warning("ADMIN %s deleted order %s (%s tickets)", admin.get("email"), order_id, t.deleted_count)
    return {"ok": True, "deleted_tickets": t.deleted_count}


@api_router.post("/admin/orders/{order_id}/resend-email")
async def resend_ticket_email(order_id: str, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    if (order.get("payment_status") or order.get("status")) not in ("paid", "paid_mock"):
        raise HTTPException(400, "Ticket emails can only be resent for paid orders")
    try:
        email_id = await send_ticket_email(order)
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"ticket_email_sent_at": utcnow().isoformat(),
                      "ticket_email_id": email_id, "ticket_email_error": None}},
        )
        return {"ok": True, "email_id": email_id}
    except Exception as e:
        logger.error("Admin resend email failed for order %s: %s", order_id, str(e)[:250])
        if not order.get("ticket_email_sent_at"):
            await db.orders.update_one(
                {"id": order_id}, {"$set": {"ticket_email_error": str(e)[:250]}})
        msg = str(e)[:200]
        if "Undeliverable recipient" in msg:
            raise HTTPException(422, msg)
        if "429" in msg or "Rate limited" in msg:
            raise HTTPException(429, "Email service is rate-limited right now — the ticket email will be retried automatically. Try again in a few minutes.")
        raise HTTPException(502, f"Email send failed: {msg}")


@api_router.get("/admin/messages")
async def admin_messages(admin=Depends(get_current_admin)):
    return await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


MESSAGE_STATUSES = {"new", "contacted", "confirmed", "declined"}
MESSAGE_FLOORS = {"Seoul Floor (7th)", "Saigon Floor (5th)"}


class MessageUpdateIn(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    floor: Optional[str] = Field(default=None, max_length=60)


@api_router.put("/admin/messages/{message_id}")
async def admin_message_update(message_id: str, data: MessageUpdateIn, admin=Depends(get_current_admin)):
    upd = {}
    if data.status is not None:
        status = data.status.strip().lower()
        if status not in MESSAGE_STATUSES:
            raise HTTPException(400, "Invalid status")
        upd["status"] = status
    if data.notes is not None:
        upd["notes"] = data.notes
    if data.floor is not None:
        if data.floor and data.floor not in MESSAGE_FLOORS:
            raise HTTPException(400, "Invalid floor")
        upd["floor"] = data.floor
    if not upd:
        raise HTTPException(400, "Nothing to update")
    upd["updated_at"] = utcnow().isoformat()
    upd["updated_by"] = admin.get("email")
    r = await db.messages.update_one({"id": message_id}, {"$set": upd})
    if not r.matched_count:
        raise HTTPException(404, "Message not found")
    return {"ok": True, **upd}


@api_router.post("/admin/messages/{message_id}/remove")
async def admin_message_remove(message_id: str, admin=Depends(get_current_admin)):
    r = await db.messages.update_one(
        {"id": message_id},
        {"$set": {"removed": True, "updated_at": utcnow().isoformat()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Message not found")
    return {"ok": True, "removed": True}


@api_router.post("/admin/messages/{message_id}/restore")
async def admin_message_restore(message_id: str, admin=Depends(get_current_admin)):
    r = await db.messages.update_one(
        {"id": message_id},
        {"$set": {"removed": False, "updated_at": utcnow().isoformat()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Message not found")
    return {"ok": True, "removed": False}


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
            "date": "2026-09-27T22:00:00+02:00",
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
    await db.orders.create_index("id", unique=True)
    await db.sim_payments.create_index("id", unique=True)
    await db.meta_events.create_index("event_id", unique=True)
    await db.email_rate.create_index("key", unique=True)
    await db.ambassadors.create_index("code", unique=True)
    await db.promo_codes.create_index("code", unique=True)
    await db.promo_codes.update_one(
        {"code": "ATFTEST95"},
        {"$set": {"active": False}, "$setOnInsert": {"code": "ATFTEST95", "percent_off": 95}},
        upsert=True,
    )
    await db.promo_codes.update_one(
        {"code": "MZYPL5BKOD"},
        {"$set": {"active": True}, "$setOnInsert": {"code": "MZYPL5BKOD", "percent_off": 95}},
        upsert=True,
    )
    await seed_admin()
    await seed_event()
    asyncio.create_task(retry_unsent_ticket_emails())
    asyncio.create_task(teya_reconcile_sweep())


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
