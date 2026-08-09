"""ConsMat Admin API (mock backend implementing the documented /api/v1 contract).

NOTE: This is a lightweight MOCK backend serving the exact REST contract the
frontend expects. It issues real JWT bearer tokens and serves realistic seeded
data so the Admin console is fully demonstrable end-to-end.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import jwt
import bcrypt
from typing import Optional, List
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

# ---------------------------------------------------------------------------
# Config / DB
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("consmat")

app = FastAPI(title="ConsMat Admin API", version="0.1.0")
api = APIRouter(prefix="/api/v1")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user: dict) -> str:
    payload = {
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": payload.get("email")})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class BulkApproveRequest(BaseModel):
    ids: List[str]


class BulkRejectRequest(BaseModel):
    ids: List[str]
    reason: str = ""


class ReplyRequest(BaseModel):
    reply: str


def _in_range(created_at: str, start: Optional[str], end: Optional[str]) -> bool:
    try:
        d = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except Exception:
        return True
    if start:
        s = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
        if d < s:
            return False
    if end:
        e = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) + timedelta(days=1)
        if d >= e:
            return False
    return True


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/login")
async def login(body: LoginRequest):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": str(user["_id"]), "name": user.get("name"), "email": user["email"], "role": user["role"]},
    }


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": str(user["_id"]), "name": user.get("name"), "email": user["email"], "role": user["role"]}


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------
@api.get("/admin/metrics")
async def admin_metrics(start: Optional[str] = None, end: Optional[str] = None, _: dict = Depends(require_admin)):
    vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
    all_orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    orders = [o for o in all_orders if _in_range(o["created_at"], start, end)]
    gmv = sum(o["amount"] for o in orders if o["status"] != "cancelled")
    active_vendors = sum(1 for v in vendors if v["kyc_status"] == "approved")
    pending_kyc = sum(1 for v in vendors if v["kyc_status"] == "pending")
    return {
        "gmv": gmv,
        "currency": "INR",
        "orders": len(orders),
        "active_vendors": active_vendors,
        "pending_kyc": pending_kyc,
        "period": {"start": start, "end": end},
    }


@api.get("/admin/vendors")
async def admin_vendors(_: dict = Depends(require_admin)):
    vendors = await db.vendors.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return vendors


@api.post("/admin/vendors/bulk-approve")
async def bulk_approve_vendors(body: BulkApproveRequest, _: dict = Depends(require_admin)):
    if not body.ids:
        return {"approved": 0, "vendors": []}
    await db.vendors.update_many({"id": {"$in": body.ids}}, {"$set": {"kyc_status": "approved", "rejection_reason": None}})
    vendors = await db.vendors.find({"id": {"$in": body.ids}}, {"_id": 0}).to_list(1000)
    return {"approved": len(vendors), "vendors": vendors}


@api.post("/admin/vendors/bulk-reject")
async def bulk_reject_vendors(body: BulkRejectRequest, _: dict = Depends(require_admin)):
    if not body.ids:
        return {"rejected": 0, "vendors": []}
    await db.vendors.update_many({"id": {"$in": body.ids}}, {"$set": {"kyc_status": "rejected", "rejection_reason": body.reason}})
    vendors = await db.vendors.find({"id": {"$in": body.ids}}, {"_id": 0}).to_list(1000)
    return {"rejected": len(vendors), "vendors": vendors}


@api.post("/admin/vendors/{vendor_id}/reviews/{review_id}/reply")
async def reply_review(vendor_id: str, review_id: str, body: ReplyRequest, _: dict = Depends(require_admin)):
    vendor = await db.vendors.find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    reviews = vendor.get("reviews", [])
    found = False
    for r in reviews:
        if r.get("id") == review_id:
            r["admin_reply"] = body.reply
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.vendors.update_one({"id": vendor_id}, {"$set": {"reviews": reviews}})
    return {"ok": True, "reviews": reviews}


@api.post("/admin/vendors/{vendor_id}/approve")
async def approve_vendor(vendor_id: str, _: dict = Depends(require_admin)):
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await db.vendors.update_one({"id": vendor_id}, {"$set": {"kyc_status": "approved"}})
    vendor["kyc_status"] = "approved"
    return vendor


@api.get("/admin/vendors/{vendor_id}")
async def vendor_detail(vendor_id: str, _: dict = Depends(require_admin)):
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    history = await db.orders.find({"vendor": vendor["name"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    vendor["order_history"] = history
    return vendor


@api.get("/admin/orders")
async def admin_orders(start: Optional[str] = None, end: Optional[str] = None, _: dict = Depends(require_admin)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    if start or end:
        orders = [o for o in orders if _in_range(o["created_at"], start, end)]
    return orders


@api.get("/admin/orders/{order_id}")
async def order_detail(order_id: str, _: dict = Depends(require_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api.get("/admin/logistics-config")
async def get_logistics_config(_: dict = Depends(require_admin)):
    cfg = await db.logistics_config.find_one({"_id": "config"}, {"_id": 0})
    return cfg or {}


@api.put("/admin/logistics-config")
async def put_logistics_config(payload: dict, _: dict = Depends(require_admin)):
    payload.pop("_id", None)
    await db.logistics_config.update_one({"_id": "config"}, {"$set": payload}, upsert=True)
    cfg = await db.logistics_config.find_one({"_id": "config"}, {"_id": 0})
    return cfg


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
BUYERS = {
    "Skyline Builders": {"phone": "+91 98200 11223", "email": "procurement@skylinebuilders.in", "address": "Plot 14, MIDC Phase II, Andheri East, Mumbai 400093", "gstin": "27AABCS1234K1Z5", "contact": "Rohit Shah"},
    "Metro Infra Pvt Ltd": {"phone": "+91 90040 55667", "email": "orders@metroinfra.co.in", "address": "Metro House, Baner Road, Pune 411045", "gstin": "27AACCM7788L1ZP", "contact": "Sneha Kulkarni"},
    "GreenNest Homes": {"phone": "+91 99860 22110", "email": "buy@greennesthomes.in", "address": "Sector 7, HSR Layout, Bengaluru 560102", "gstin": "29AAGCG9012M1Z3", "contact": "Arjun Reddy"},
    "Urban Interiors": {"phone": "+91 98110 44556", "email": "supply@urbaninteriors.in", "address": "A-22, Okhla Industrial Area, New Delhi 110020", "gstin": "07AAECU4455N1Z8", "contact": "Priya Malhotra"},
    "TileFix Contractors": {"phone": "+91 90030 77889", "email": "site@tilefix.in", "address": "3rd Cross, Peelamedu, Coimbatore 641004", "gstin": "33AAFCT6677P1Z1", "contact": "Manoj Kumar"},
    "Coastal Developers": {"phone": "+91 98450 33221", "email": "materials@coastaldev.in", "address": "Marine Drive, Kadri, Mangaluru 575003", "gstin": "29AAKCC3344Q1Z6", "contact": "Fatima Sheikh"},
}

SEED_VENDORS = [
    {"id": "v-1001", "name": "Sterling Cement Co.", "category": "Cement", "city": "Mumbai", "rating": 4.6, "rating_count": 214, "kyc_status": "approved", "gmv": 4820000, "orders": 214, "contact": "Rahul Mehta", "gstin": "27AABCS5678H1Z2", "phone": "+91 98200 44556", "email": "sales@sterlingcement.in", "established": 2009, "address": "Warehouse 5, Bhiwandi, Thane 421302"},
    {"id": "v-1002", "name": "Ironclad Steel Works", "category": "TMT Steel", "city": "Pune", "rating": 4.8, "rating_count": 302, "kyc_status": "approved", "gmv": 7310000, "orders": 302, "contact": "Anita Rao", "gstin": "27AACCI1122J1Z9", "phone": "+91 90040 11223", "email": "orders@ironcladsteel.in", "established": 2005, "address": "Chakan MIDC, Pune 410501"},
    {"id": "v-1003", "name": "RedBrick Traders", "category": "Bricks & Blocks", "city": "Nagpur", "rating": 3.9, "rating_count": 47, "kyc_status": "pending", "gmv": 0, "orders": 0, "contact": "Suresh Patil", "gstin": "27AADFR3344K1Z0", "phone": "+91 98220 66778", "email": "info@redbricktraders.in", "established": 2018, "address": "Kamptee Road, Nagpur 440026"},
    {"id": "v-1004", "name": "AquaMix Concrete", "category": "RMC", "city": "Bengaluru", "rating": 4.3, "rating_count": 128, "kyc_status": "approved", "gmv": 2950000, "orders": 128, "contact": "Deepa Nair", "gstin": "29AAECA5566L1Z4", "phone": "+91 99860 88990", "email": "dispatch@aquamix.in", "established": 2012, "address": "Peenya Industrial Area, Bengaluru 560058"},
    {"id": "v-1005", "name": "GraniteHub Supplies", "category": "Aggregates", "city": "Hyderabad", "rating": 4.1, "rating_count": 63, "kyc_status": "pending", "gmv": 0, "orders": 0, "contact": "Imran Sheikh", "gstin": "36AAFCG7788M1Z7", "phone": "+91 90000 12345", "email": "sales@granitehub.in", "established": 2016, "address": "Kukatpally, Hyderabad 500072"},
    {"id": "v-1006", "name": "Pinnacle Paints", "category": "Paints & Finishes", "city": "Delhi", "rating": 4.5, "rating_count": 96, "kyc_status": "approved", "gmv": 1670000, "orders": 96, "contact": "Vikram Singh", "gstin": "07AAGCP9900N1Z1", "phone": "+91 98110 22334", "email": "b2b@pinnaclepaints.in", "established": 2010, "address": "Okhla Phase I, New Delhi 110020"},
    {"id": "v-1007", "name": "TileMaster Ceramics", "category": "Tiles & Sanitary", "city": "Ahmedabad", "rating": 4.0, "rating_count": 55, "kyc_status": "pending", "gmv": 0, "orders": 0, "contact": "Meera Joshi", "gstin": "24AAHCT1234P1Z8", "phone": "+91 90990 55667", "email": "hello@tilemaster.in", "established": 2015, "address": "Morbi Road, Ahmedabad 382210"},
    {"id": "v-1008", "name": "Everbond Adhesives", "category": "Chemicals", "city": "Chennai", "rating": 4.4, "rating_count": 61, "kyc_status": "approved", "gmv": 890000, "orders": 61, "contact": "Karthik Iyer", "gstin": "33AAJCE4455Q1Z3", "phone": "+91 90030 99001", "email": "care@everbond.in", "established": 2014, "address": "Ambattur Industrial Estate, Chennai 600058"},
]

# order_id -> (vendor, buyer, status, rating, created_at, [line_items(name, qty, unit, unit_price)])
SEED_ORDERS = [
    {"id": "ORD-5501", "vendor": "Ironclad Steel Works", "buyer": "Skyline Builders", "status": "delivered", "rating": 5, "created_at": "2026-06-18T09:20:00Z",
     "lines": [("TMT Bar Fe-550 12mm", 5, "Ton", 68400)]},
    {"id": "ORD-5502", "vendor": "Sterling Cement Co.", "buyer": "Metro Infra Pvt Ltd", "status": "in_transit", "rating": 0, "created_at": "2026-06-18T07:05:00Z",
     "lines": [("OPC 53 Grade Cement", 400, "bags", 390)]},
    {"id": "ORD-5503", "vendor": "AquaMix Concrete", "buyer": "GreenNest Homes", "status": "delivered", "rating": 4, "created_at": "2026-06-17T15:40:00Z",
     "lines": [("M25 Ready-Mix Concrete", 18, "cu.m", 6000)]},
    {"id": "ORD-5504", "vendor": "Pinnacle Paints", "buyer": "Urban Interiors", "status": "processing", "rating": 0, "created_at": "2026-06-17T11:12:00Z",
     "lines": [("Weatherproof Exterior Emulsion", 220, "Litre", 340)]},
    {"id": "ORD-5505", "vendor": "Everbond Adhesives", "buyer": "TileFix Contractors", "status": "delivered", "rating": 5, "created_at": "2026-06-16T18:25:00Z",
     "lines": [("Tile Adhesive C2TE", 80, "bags", 520)]},
    {"id": "ORD-5506", "vendor": "Ironclad Steel Works", "buyer": "Coastal Developers", "status": "delivered", "rating": 4, "created_at": "2026-06-16T10:00:00Z",
     "lines": [("TMT Bar Fe-500 16mm", 3, "Ton", 67000)]},
    {"id": "ORD-5507", "vendor": "Sterling Cement Co.", "buyer": "Skyline Builders", "status": "cancelled", "rating": 0, "created_at": "2026-06-15T13:30:00Z",
     "lines": [("PPC Cement", 600, "bags", 350)]},
    {"id": "ORD-5508", "vendor": "AquaMix Concrete", "buyer": "Metro Infra Pvt Ltd", "status": "in_transit", "rating": 0, "created_at": "2026-06-15T08:45:00Z",
     "lines": [("M30 Ready-Mix Concrete", 24, "cu.m", 7000)]},
    {"id": "ORD-5509", "vendor": "Pinnacle Paints", "buyer": "GreenNest Homes", "status": "delivered", "rating": 4, "created_at": "2026-06-14T16:10:00Z",
     "lines": [("Wall Primer", 90, "Litre", 250), ("Wall Putty", 200, "kg", 150)]},
    {"id": "ORD-5510", "vendor": "Everbond Adhesives", "buyer": "Urban Interiors", "status": "processing", "rating": 0, "created_at": "2026-06-14T09:55:00Z",
     "lines": [("Epoxy Grout Kit", 40, "kits", 2400)]},
]

DEFAULT_LOGISTICS = {
    "base_delivery_fee": 250,
    "per_km_rate": 18,
    "free_delivery_threshold": 50000,
    "max_delivery_radius_km": 120,
    "express_surcharge_multiplier": 1.75,
    "handling_fee": 120,
    "cod_enabled": True,
    "cod_max_order_value": 100000,
    "same_day_delivery": False,
    "default_dispatch_hub": "Central Warehouse - Bhiwandi",
}

DOC_TEMPLATE = [("GST Certificate", "PDF"), ("PAN Card", "PDF"), ("Trade License", "PDF"), ("Cancelled Cheque", "IMG")]


def build_documents(kyc_status: str):
    docs = []
    for i, (name, typ) in enumerate(DOC_TEMPLATE):
        if kyc_status == "approved":
            status = "verified"
        else:
            status = "verified" if i < 2 else "pending"
        docs.append({"name": name, "type": typ, "status": status, "size_kb": 120 + i * 46})
    return docs


def build_timeline(status: str, created_iso: str):
    base = datetime.fromisoformat(created_iso.replace("Z", "+00:00"))
    if status == "cancelled":
        steps = [("placed", "Order Placed", 0), ("confirmed", "Confirmed by Vendor", 2), ("cancelled", "Order Cancelled", 5)]
        return [{"key": k, "label": l, "at": (base + timedelta(hours=h)).isoformat(), "done": True} for k, l, h in steps]
    flow = [("placed", "Order Placed", 0), ("confirmed", "Confirmed by Vendor", 2), ("dispatched", "Dispatched from Hub", 8), ("in_transit", "In Transit", 20), ("delivered", "Delivered", 40)]
    reached = {"processing": 2, "in_transit": 4, "delivered": 5}.get(status, 1)
    return [{"key": k, "label": l, "at": (base + timedelta(hours=h)).isoformat(), "done": idx <= reached} for idx, (k, l, h) in enumerate(flow, start=1)]


def build_order(o: dict):
    line_items = [{"name": n, "qty": q, "unit": u, "unit_price": p, "amount": q * p} for (n, q, u, p) in o["lines"]]
    amount = sum(li["amount"] for li in line_items)
    return {
        "id": o["id"], "vendor": o["vendor"], "buyer": o["buyer"], "status": o["status"], "rating": o["rating"],
        "created_at": o["created_at"], "item": ", ".join(li["name"] for li in line_items),
        "line_items": line_items, "amount": amount,
        "buyer_contact": BUYERS.get(o["buyer"], {}),
        "timeline": build_timeline(o["status"], o["created_at"]),
    }


REVIEWS = {
    "v-1001": [
        {"buyer": "Skyline Builders", "rating": 5, "comment": "Consistent OPC quality across three tower sites. Dispatch always on schedule.", "date": "2026-06-10"},
        {"buyer": "Metro Infra Pvt Ltd", "rating": 4, "comment": "Reliable supplier, invoicing was slightly delayed once but resolved quickly.", "date": "2026-05-28"},
        {"buyer": "GreenNest Homes", "rating": 5, "comment": "Great bulk pricing and the bags were well palletised.", "date": "2026-05-12"},
    ],
    "v-1002": [
        {"buyer": "Skyline Builders", "rating": 5, "comment": "Best TMT vendor on the platform. Test certificates provided every time.", "date": "2026-06-15"},
        {"buyer": "Coastal Developers", "rating": 5, "comment": "Fe-500 bars bang on spec. Zero rejections at QC.", "date": "2026-06-02"},
        {"buyer": "Metro Infra Pvt Ltd", "rating": 4, "comment": "Excellent quality, would like faster turnaround on large tonnage.", "date": "2026-05-20"},
    ],
    "v-1004": [
        {"buyer": "GreenNest Homes", "rating": 4, "comment": "RMC arrived at the right slump. Pump coordination was smooth.", "date": "2026-06-08"},
        {"buyer": "Metro Infra Pvt Ltd", "rating": 5, "comment": "M30 grade delivered on time for a night pour. Impressive.", "date": "2026-05-30"},
    ],
    "v-1006": [
        {"buyer": "Urban Interiors", "rating": 5, "comment": "Colour consistency across batches is excellent for large facades.", "date": "2026-06-11"},
        {"buyer": "GreenNest Homes", "rating": 4, "comment": "Good coverage, primer combo saved us a trip.", "date": "2026-05-25"},
    ],
    "v-1008": [
        {"buyer": "TileFix Contractors", "rating": 5, "comment": "C2TE adhesive bonds beautifully, no hollowness after 30 days.", "date": "2026-06-09"},
        {"buyer": "Urban Interiors", "rating": 4, "comment": "Epoxy grout kits are premium. Slightly pricey but worth it.", "date": "2026-05-18"},
    ],
}


def build_rating_breakdown(rating: float, count: int):
    if count <= 0:
        return {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    weights = {s: max(0.03, 1 - abs(s - rating) / 2.4) for s in range(1, 6)}
    total_w = sum(weights.values())
    dist = {s: int(round(count * w / total_w)) for s, w in weights.items()}
    diff = count - sum(dist.values())
    peak = int(round(rating))
    dist[peak] = max(0, dist.get(peak, 0) + diff)
    return {str(s): dist[s] for s in range(5, 0, -1)}


def build_vendor(v: dict):
    approved = v["kyc_status"] == "approved"
    reviews = [{**r, "id": f"{v['id']}-r{i}", "admin_reply": None} for i, r in enumerate(REVIEWS.get(v["id"], []))]
    return {
        **v,
        "documents": build_documents(v["kyc_status"]),
        "reviews": reviews,
        "rating_breakdown": build_rating_breakdown(v["rating"], v["rating_count"]) if approved else {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0},
    }


@app.on_event("startup")
async def seed():
    if not await db.users.find_one({"email": ADMIN_EMAIL}):
        await db.users.insert_one({
            "email": ADMIN_EMAIL.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "ConsMat Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user %s", ADMIN_EMAIL)
    else:
        existing = await db.users.find_one({"email": ADMIN_EMAIL})
        if not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # Always reseed marketplace data so schema stays in sync with the mock contract.
    await db.vendors.delete_many({})
    await db.vendors.insert_many([build_vendor(v) for v in SEED_VENDORS])
    await db.orders.delete_many({})
    await db.orders.insert_many([build_order(o) for o in SEED_ORDERS])
    logger.info("Seeded vendors and orders")

    if not await db.logistics_config.find_one({"_id": "config"}):
        await db.logistics_config.insert_one({"_id": "config", **DEFAULT_LOGISTICS})
        logger.info("Seeded logistics config")


@app.on_event("shutdown")
async def shutdown():
    client.close()
