"""
Thin MOCK backend implementing the EXACT external API contract the Operator
frontend consumes (prefix /api/v1). This exists ONLY because the real backend
described in the task (http://localhost:3000) is not reachable from a browser
in this cloud environment. All data below is MOCKED / in-memory seed data.

Contract:
  POST   /api/v1/auth/login
  GET    /api/v1/operator/dispatch-queue
  POST   /api/v1/operator/dispatch/{order_id}
  POST   /api/v1/operator/deliver/{order_id}
  GET    /api/v1/operator/network-stock
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, APIRouter, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Consmat Operator API (mock)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api/v1")

DEMO_PASSWORD = "consmat123"

USERS = {
    "operator@consmat.in": {
        "id": "u-op-1",
        "name": "Ravi Kulkarni",
        "email": "operator@consmat.in",
        "role": "operator",
    },
}

# In-memory token store (MOCK, not a real JWT).
TOKENS = {}


def _now():
    return datetime.now(timezone.utc)


def _iso(dt):
    return dt.isoformat()


# ---------------------------------------------------------------- seed data
def _seed_queue():
    return [
        {
            "order_id": "ORD-24817",
            "status": "pending",
            "priority": "high",
            "placed_at": _iso(_now() - timedelta(minutes=18)),
            "customer": {
                "name": "Skyline Constructions",
                "phone": "+91 98450 11223",
                "site": "Tower B, Whitefield",
                "address": "Plot 42, ITPL Main Rd, Whitefield, Bengaluru 560066",
            },
            "vendors": [
                {
                    "vendor_id": "V-01",
                    "vendor_name": "Deccan Cement Depot",
                    "rating": 4.6,
                    "items": [
                        {"name": "OPC 53 Grade Cement", "qty": 120, "unit": "bags", "price": 410},
                        {"name": "PPC Cement", "qty": 40, "unit": "bags", "price": 385},
                    ],
                },
                {
                    "vendor_id": "V-02",
                    "vendor_name": "Sri Balaji Steels",
                    "rating": 4.2,
                    "items": [
                        {"name": "TMT Bar Fe550 12mm", "qty": 2.5, "unit": "tonnes", "price": 62000},
                    ],
                },
            ],
        },
        {
            "order_id": "ORD-24820",
            "status": "pending",
            "priority": "normal",
            "placed_at": _iso(_now() - timedelta(minutes=44)),
            "customer": {
                "name": "Ganesh Reddy",
                "phone": "+91 90080 55447",
                "site": "Villa Renovation",
                "address": "14, 3rd Cross, Koramangala 5th Block, Bengaluru 560095",
            },
            "vendors": [
                {
                    "vendor_id": "V-03",
                    "vendor_name": "Coromandel Bricks",
                    "rating": 3.9,
                    "items": [
                        {"name": "Red Clay Bricks", "qty": 4000, "unit": "pcs", "price": 9},
                        {"name": "Fly Ash Bricks", "qty": 2000, "unit": "pcs", "price": 7},
                    ],
                },
                {
                    "vendor_id": "V-04",
                    "vendor_name": "Nandi River Sand Co.",
                    "rating": 4.4,
                    "items": [
                        {"name": "M-Sand", "qty": 3, "unit": "units", "price": 4200},
                    ],
                },
                {
                    "vendor_id": "V-01",
                    "vendor_name": "Deccan Cement Depot",
                    "rating": 4.6,
                    "items": [
                        {"name": "OPC 43 Grade Cement", "qty": 60, "unit": "bags", "price": 395},
                    ],
                },
            ],
        },
        {
            "order_id": "ORD-24805",
            "status": "dispatched",
            "priority": "high",
            "placed_at": _iso(_now() - timedelta(hours=2, minutes=5)),
            "dispatched_at": _iso(_now() - timedelta(minutes=25)),
            "customer": {
                "name": "Prestige Infra Pvt Ltd",
                "phone": "+91 99860 33119",
                "site": "Metro Phase 3",
                "address": "Yeshwanthpur Industrial Area, Bengaluru 560022",
            },
            "vendors": [
                {
                    "vendor_id": "V-02",
                    "vendor_name": "Sri Balaji Steels",
                    "rating": 4.2,
                    "items": [
                        {"name": "TMT Bar Fe500 16mm", "qty": 5, "unit": "tonnes", "price": 61000},
                        {"name": "Binding Wire", "qty": 80, "unit": "kg", "price": 78},
                    ],
                },
            ],
        },
        {
            "order_id": "ORD-24788",
            "status": "dispatched",
            "priority": "high",
            "eta_minutes": 45,
            "placed_at": _iso(_now() - timedelta(hours=3)),
            "dispatched_at": _iso(_now() - timedelta(hours=1, minutes=30)),
            "customer": {
                "name": "Sunrise Developers",
                "phone": "+91 98867 44551",
                "site": "Apartment Block C",
                "address": "Sarjapur Road, Bengaluru 560103",
            },
            "vendors": [
                {
                    "vendor_id": "V-01",
                    "vendor_name": "Deccan Cement Depot",
                    "rating": 4.6,
                    "items": [
                        {"name": "OPC 53 Grade Cement", "qty": 200, "unit": "bags", "price": 410},
                    ],
                },
            ],
        },
        {
            "order_id": "ORD-24799",
            "status": "pending",
            "priority": "normal",
            "placed_at": _iso(_now() - timedelta(hours=1, minutes=12)),
            "customer": {
                "name": "Lakshmi Interiors",
                "phone": "+91 97410 88220",
                "site": "Office Fitout",
                "address": "22, MG Road, Indiranagar, Bengaluru 560038",
            },
            "vendors": [
                {
                    "vendor_id": "V-05",
                    "vendor_name": "Ultra Aggregates",
                    "rating": 4.1,
                    "items": [
                        {"name": "20mm Jelly (Gravel)", "qty": 2, "unit": "units", "price": 3800},
                        {"name": "40mm Jelly (Gravel)", "qty": 1, "unit": "units", "price": 3600},
                    ],
                },
            ],
        },
    ]


QUEUE = _seed_queue()

NETWORK_STOCK = [
    {
        "product_id": "P-CEM-53", "name": "OPC 53 Grade Cement", "category": "Cement",
        "unit": "bags",
        "vendors": [
            {"vendor_id": "V-01", "vendor_name": "Deccan Cement Depot", "rating": 4.6, "stock": 1840, "price": 410},
            {"vendor_id": "V-07", "vendor_name": "Kaveri Building Mart", "rating": 4.0, "stock": 620, "price": 418},
        ],
    },
    {
        "product_id": "P-CEM-PPC", "name": "PPC Cement", "category": "Cement",
        "unit": "bags",
        "vendors": [
            {"vendor_id": "V-01", "vendor_name": "Deccan Cement Depot", "rating": 4.6, "stock": 960, "price": 385},
        ],
    },
    {
        "product_id": "P-TMT-550", "name": "TMT Bar Fe550 12mm", "category": "Steel",
        "unit": "tonnes",
        "vendors": [
            {"vendor_id": "V-02", "vendor_name": "Sri Balaji Steels", "rating": 4.2, "stock": 42, "price": 62000},
            {"vendor_id": "V-08", "vendor_name": "Hosur Iron Works", "rating": 3.7, "stock": 18, "price": 63500},
        ],
    },
    {
        "product_id": "P-BRK-RED", "name": "Red Clay Bricks", "category": "Bricks & Blocks",
        "unit": "pcs",
        "vendors": [
            {"vendor_id": "V-03", "vendor_name": "Coromandel Bricks", "rating": 3.9, "stock": 82000, "price": 9},
            {"vendor_id": "V-09", "vendor_name": "Anjaneya Blocks", "rating": 4.3, "stock": 45000, "price": 8},
        ],
    },
    {
        "product_id": "P-SAND-M", "name": "M-Sand", "category": "Sand & Aggregates",
        "unit": "units",
        "vendors": [
            {"vendor_id": "V-04", "vendor_name": "Nandi River Sand Co.", "rating": 4.4, "stock": 120, "price": 4200},
            {"vendor_id": "V-05", "vendor_name": "Ultra Aggregates", "rating": 4.1, "stock": 75, "price": 4350},
        ],
    },
    {
        "product_id": "P-JELLY-20", "name": "20mm Jelly (Gravel)", "category": "Sand & Aggregates",
        "unit": "units",
        "vendors": [
            {"vendor_id": "V-05", "vendor_name": "Ultra Aggregates", "rating": 4.1, "stock": 4, "price": 3800},
        ],
    },
    {
        "product_id": "P-BRK-FLY", "name": "Fly Ash Bricks", "category": "Bricks & Blocks",
        "unit": "pcs",
        "vendors": [
            {"vendor_id": "V-03", "vendor_name": "Coromandel Bricks", "rating": 3.9, "stock": 0, "price": 7},
            {"vendor_id": "V-09", "vendor_name": "Anjaneya Blocks", "rating": 4.3, "stock": 26000, "price": 7},
        ],
    },
]


# ---------------------------------------------------------------- helpers
def _enrich(ticket):
    total = 0.0
    item_count = 0
    for v in ticket["vendors"]:
        sub = 0.0
        for it in v["items"]:
            sub += it["qty"] * it["price"]
            item_count += 1
        v["subtotal"] = round(sub, 2)
        total += sub
    ticket = dict(ticket)
    ticket["total"] = round(total, 2)
    ticket["vendor_count"] = len(ticket["vendors"])
    ticket["item_count"] = item_count
    eta_minutes = ticket.get("eta_minutes", 45)
    ticket["eta_minutes"] = eta_minutes
    if ticket.get("status") == "dispatched" and ticket.get("dispatched_at"):
        try:
            base = datetime.fromisoformat(ticket["dispatched_at"])
            ticket["eta_at"] = _iso(base + timedelta(minutes=eta_minutes))
        except Exception:
            ticket["eta_at"] = None
    return ticket


def _auth(authorization):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if token not in TOKENS:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return TOKENS[token]


class LoginBody(BaseModel):
    email: str | None = None
    username: str | None = None
    password: str


class ReorderBody(BaseModel):
    product_id: str
    vendor_id: str | None = None
    qty: int | None = None


class DeliverBody(BaseModel):
    proof: str | None = None
    proof_type: str | None = None
    note: str | None = None


class ViewBody(BaseModel):
    name: str
    filter: str = "all"
    search: str = ""
    sort: str = "newest"
    created_by: str | None = None


# Shared team views (in-memory, visible to every operator on this mock)
SHARED_VIEWS = [
    {"id": "sv-seed-1", "name": "High priority", "filter": "pending", "search": "", "sort": "priority", "created_by": "Team"},
]


DEFAULT_RESTOCK = {"bags": 1000, "tonnes": 40, "units": 100, "kg": 500, "pcs": 50000}


# ---------------------------------------------------------------- routes
@api.get("/")
async def root():
    return {"service": "consmat-operator-mock", "status": "ok"}


@api.post("/auth/login")
async def login(body: LoginBody):
    key = (body.email or body.username or "").strip().lower()
    if not key:
        key = "operator@consmat.in"
    user = USERS.get(key) or USERS["operator@consmat.in"]
    if body.password != DEMO_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = uuid.uuid4().hex
    TOKENS[token] = user
    return {"access_token": token, "token_type": "bearer", "user": user}


@api.get("/operator/dispatch-queue")
async def dispatch_queue(authorization: str | None = Header(default=None)):
    _auth(authorization)
    return {"tickets": [_enrich(t) for t in QUEUE]}


@api.post("/operator/dispatch/{order_id}")
async def dispatch(order_id: str, authorization: str | None = Header(default=None)):
    _auth(authorization)
    for t in QUEUE:
        if t["order_id"] == order_id:
            if t["status"] == "delivered":
                raise HTTPException(status_code=400, detail="Order already delivered")
            t["status"] = "dispatched"
            t["dispatched_at"] = _iso(_now())
            return {"ok": True, "order_id": order_id, "status": "dispatched", "ticket": _enrich(t)}
    raise HTTPException(status_code=404, detail="Order not found")


@api.post("/operator/deliver/{order_id}")
async def deliver(
    order_id: str,
    body: DeliverBody | None = None,
    authorization: str | None = Header(default=None),
):
    _auth(authorization)
    for t in QUEUE:
        if t["order_id"] == order_id:
            t["status"] = "delivered"
            t["delivered_at"] = _iso(_now())
            if body and body.proof:
                t["proof"] = body.proof
                t["proof_type"] = body.proof_type or "photo"
            if body and body.note:
                t["note"] = body.note
            return {"ok": True, "order_id": order_id, "status": "delivered", "ticket": _enrich(t)}
    raise HTTPException(status_code=404, detail="Order not found")


@api.get("/operator/network-stock")
async def network_stock(authorization: str | None = Header(default=None)):
    _auth(authorization)
    out = []
    for p in NETWORK_STOCK:
        total = sum(v["stock"] for v in p["vendors"])
        item = dict(p)
        item["total_available"] = total
        out.append(item)
    return {"products": out}


@api.post("/operator/reorder")
async def reorder(body: ReorderBody, authorization: str | None = Header(default=None)):
    _auth(authorization)
    product = next((p for p in NETWORK_STOCK if p["product_id"] == body.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    qty = body.qty or DEFAULT_RESTOCK.get(product["unit"], 100)

    if body.vendor_id:
        vendor = next((v for v in product["vendors"] if v["vendor_id"] == body.vendor_id), None)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found for product")
        vendor["stock"] += qty
        target = vendor["vendor_name"]
    else:
        # restock the lowest-stock vendor
        vendor = min(product["vendors"], key=lambda v: v["stock"])
        vendor["stock"] += qty
        target = vendor["vendor_name"]

    total = sum(v["stock"] for v in product["vendors"])
    enriched = dict(product)
    enriched["total_available"] = total
    return {
        "ok": True,
        "reorder_id": f"RO-{uuid.uuid4().hex[:6].upper()}",
        "product_id": product["product_id"],
        "vendor_name": target,
        "qty": qty,
        "unit": product["unit"],
        "product": enriched,
    }


@api.get("/operator/views")
async def list_views(authorization: str | None = Header(default=None)):
    _auth(authorization)
    return {"views": SHARED_VIEWS}


@api.post("/operator/views")
async def create_view(body: ViewBody, authorization: str | None = Header(default=None)):
    user = _auth(authorization)
    view = {
        "id": f"sv-{uuid.uuid4().hex[:8]}",
        "name": body.name.strip() or "Untitled view",
        "filter": body.filter,
        "search": body.search,
        "sort": body.sort,
        "created_by": body.created_by or user.get("name", "Operator"),
    }
    SHARED_VIEWS.insert(0, view)
    return {"ok": True, "view": view}


@api.delete("/operator/views/{view_id}")
async def delete_view(view_id: str, authorization: str | None = Header(default=None)):
    _auth(authorization)
    before = len(SHARED_VIEWS)
    SHARED_VIEWS[:] = [v for v in SHARED_VIEWS if v["id"] != view_id]
    if len(SHARED_VIEWS) == before:
        raise HTTPException(status_code=404, detail="View not found")
    return {"ok": True, "id": view_id}


app.include_router(api)
