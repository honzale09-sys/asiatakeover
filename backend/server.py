from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import base64
import hashlib
import io
import ipaddress
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
    "SUCCESS": "paid", "SUCCEEDED": "paid", "COMPLETED": "paid", "AUTHORIZED": "paid",
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
    return "VIP Table Ticket" if "VIP" in (tier_name or "").upper() else "Standard Ticket"


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


# ---------------- transactional email (Emergent managed Resend) ----------------

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Asia Takeover")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO") or None

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


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks recipient for credentials: {p!r}")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r}")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r}")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r}")


async def send_email(*, to: str, subject: str, html: str, reply_to: Optional[str] = None):
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
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


@api_router.get("/qr/{code}.png")
async def qr_png(code: str):
    clean = code.strip().upper()
    if not re.fullmatch(r"ATF-[0-9A-F]{6}", clean):
        raise HTTPException(404, "Unknown code")
    img = qrcode.make(clean, box_size=10, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


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
    try:
        email_id = await send_ticket_email(order)
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"ticket_email_sent_at": utcnow().isoformat(),
                      "ticket_email_id": email_id, "ticket_email_error": None}},
        )
    except Exception as e:
        logger.error("Ticket email failed for order %s: %s", order_id, str(e)[:250])
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"ticket_email_error": str(e)[:250]}},
        )
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
    promo = await db.promo_codes.find_one({"code": code.strip().upper(), "active": True})
    if not promo:
        return {"valid": False}
    return {"valid": True, "percent_off": promo["percent_off"]}


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
    if "VIP" not in tier["name"].upper():
        ga_tiers = await db.ticket_tiers.find({"event_id": event["id"]}).to_list(100)
        ga_tiers = [t for t in ga_tiers if "VIP" not in t["name"].upper()]
        ga_tiers.sort(key=lambda t: t["price_czk"])
        active_id = None
        for t in ga_tiers:
            if await db.tickets.count_documents({"tier_id": t["id"]}) < t["capacity"]:
                active_id = t["id"]
                break
        if active_id is None:
            raise HTTPException(400, "All releases are sold out")
        if tier["id"] != active_id:
            raise HTTPException(400, "This release is not on sale yet")
    sold = await db.tickets.count_documents({"tier_id": tier["id"]})
    if sold + data.quantity > tier["capacity"]:
        raise HTTPException(400, "Not enough tickets left in this tier")
    unit_price = tier["price_czk"]
    discount_percent = None
    if data.promo_code:
        promo = await db.promo_codes.find_one({"code": data.promo_code.strip().upper(), "active": True})
        if not promo:
            raise HTTPException(400, "Invalid discount code")
        discount_percent = promo["percent_off"]
        unit_price = max(1, round(unit_price * (100 - discount_percent) / 100))
    order = {
        "id": new_id(),
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
        "event_id": event["id"],
        "event_name": event["name"],
        "tier_id": tier["id"],
        "tier_name": ticket_display_name(tier["name"]),
        "quantity": data.quantity,
        "amount_czk": unit_price * data.quantity,
        "list_price_czk": tier["price_czk"],
        "unit_price_czk": unit_price,
        "promo_code": data.promo_code.strip().upper() if discount_percent else None,
        "discount_percent": discount_percent,
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
    if teya_configured():
        s = await teya_create_session(order)
        order["teya_session_id"] = str(s["session_id"])
        order["payment_provider"] = "teya"
        payment_url = s["session_url"]
        mode = "teya"
        order["teya_session_token"] = s["session_token"]
    elif gopay_configured():
        p = await gopay_create_payment(order)
        order["gopay_payment_id"] = str(p["id"])
        payment_url = p["gw_url"]
        mode = "gopay"
    elif payment_sim_allowed():
        pid = f"SIM-{order['id']}"
        order["gopay_payment_id"] = pid
        payment_url = f"/pay/{order['id']}"
        mode = "simulation"
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

@api_router.post("/payments/teya/notify")
async def teya_notification(request: Request):
    raw = await request.body()
    if TEYA_WEBHOOK_PUBLIC_KEY:
        sig = request.headers.get("X-Teya-Signature", "")
        try:
            import textwrap
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
            b64 = "".join(TEYA_WEBHOOK_PUBLIC_KEY.split())
            if "BEGIN PUBLIC KEY" not in b64:
                b64 = "-----BEGIN PUBLIC KEY-----\n" + "\n".join(textwrap.wrap(b64, 64)) + "\n-----END PUBLIC KEY-----\n"
            pk = serialization.load_pem_public_key(b64.encode())
            pk.verify(base64.b64decode(sig), raw, asym_padding.PKCS1v15(), hashes.SHA256())
        except Exception:
            raise HTTPException(401, "Invalid Teya signature")
    import json as _json
    try:
        event = _json.loads(raw)
    except Exception:
        raise HTTPException(400, "Bad payload")
    event_id = event.get("id") or event.get("event_id")
    if event_id and await db.meta_events.find_one({"event_id": f"teya_{event_id}"}):
        return {"ok": True}
    data = event.get("data", event)
    sid = data.get("session_id") or data.get("checkout_session_id") or data.get("id")
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
    doc = {"id": new_id(), **data.model_dump(), "created_at": utcnow().isoformat()}
    await db.messages.insert_one(doc)
    doc.pop("_id", None)
    return doc


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


@api_router.post("/scan/lookup")
async def scan_lookup(data: ScanIn, admin=Depends(get_current_admin)):
    t = await find_ticket(data.code)
    if not t:
        return {"result": "invalid", "ticket": None}
    order_status = await order_status_for(t)
    if t["status"] == "refunded" or order_status in ("refunded", "partially_refunded"):
        return {"result": "refunded", "ticket": t}
    if order_status not in ("paid", "paid_mock"):
        return {"result": "invalid", "ticket": t}
    return {"result": t["status"], "ticket": t}


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
            return {"result": "refunded", "ticket": t}
        return {"result": "valid", "ticket": t}
    existing = await db.tickets.find_one({"code": code}, {"_id": 0})
    if not existing:
        return {"result": "invalid", "ticket": None}
    if existing["status"] == "refunded":
        return {"result": "refunded", "ticket": existing}
    return {"result": "used", "ticket": existing}


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
    visible = []
    for o in orders:
        o["tickets"] = await db.tickets.find({"order_id": o["id"]}, {"_id": 0}).to_list(50)
        o["payment_status"] = o.get("payment_status") or o.get("status", "paid_mock")
        if o["payment_status"] not in ("created", "pending"):
            visible.append(o)
    return visible


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
        await db.orders.update_one(
            {"id": order_id}, {"$set": {"ticket_email_error": str(e)[:250]}})
        msg = str(e)[:200]
        if "Undeliverable recipient" in msg:
            raise HTTPException(422, msg)
        raise HTTPException(502, f"Email send failed: {msg}")


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
    await db.sim_payments.create_index("id", unique=True)
    await db.meta_events.create_index("event_id", unique=True)
    await db.promo_codes.create_index("code", unique=True)
    await db.promo_codes.update_one(
        {"code": "ATFTEST95"},
        {"$set": {"active": False}, "$setOnInsert": {"code": "ATFTEST95", "percent_off": 95}},
        upsert=True,
    )
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
