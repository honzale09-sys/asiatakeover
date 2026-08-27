from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import base64
import io
import logging
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

import bcrypt
import jwt
import qrcode
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
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


class OrderIn(BaseModel):
    event_id: str
    tier_id: str
    quantity: int = Field(ge=1, le=10)
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr


@api_router.post("/orders")
async def create_order(data: OrderIn):
    event = await db.events.find_one({"id": data.event_id}, {"_id": 0})
    if not event:
        raise HTTPException(404, "Event not found")
    tier = await db.ticket_tiers.find_one({"id": data.tier_id}, {"_id": 0})
    if not tier:
        raise HTTPException(404, "Ticket tier not found")
    sold = await db.tickets.count_documents({"tier_id": tier["id"]})
    if sold + data.quantity > tier["capacity"]:
        raise HTTPException(400, "Not enough tickets left in this tier")
    order_id = new_id()
    tickets = []
    for _ in range(data.quantity):
        code = "ATF-" + secrets.token_hex(3).upper()
        t = {
            "id": new_id(), "code": code, "order_id": order_id,
            "event_id": event["id"], "event_name": event["name"],
            "tier_id": tier["id"], "tier_name": tier["name"],
            "holder_name": data.name, "buyer_email": data.email.lower(),
            "status": "valid", "created_at": utcnow().isoformat(), "checked_in_at": None,
        }
        await db.tickets.insert_one(t)
        t.pop("_id", None)
        tickets.append(t)
    order = {
        "id": order_id, "event_id": event["id"], "tier_id": tier["id"],
        "tier_name": tier["name"], "quantity": data.quantity,
        "amount_czk": tier["price_czk"] * data.quantity,
        "buyer_name": data.name, "buyer_email": data.email.lower(),
        "status": "paid_mock", "created_at": utcnow().isoformat(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    return {"order": order, "tickets": [{**t, "qr": make_qr(t["code"])} for t in tickets]}


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    tickets = await db.tickets.find({"order_id": order_id}, {"_id": 0}).to_list(50)
    return {"order": order, "tickets": [{**t, "qr": make_qr(t["code"])} for t in tickets]}


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
                                {"$set": {"status": "used", "checked_in_at": ts}})
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
