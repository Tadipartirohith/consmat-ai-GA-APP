"""
In-memory data store, seeded entirely from config.yaml. One process holds the
shared state for all four apps (buyer/vendor/admin/operator) so an order placed
by the buyer instantly appears for the vendor, admin and operator. A threading
lock guards mutations. Everything variable lives in config.yaml — this file only
holds logic + per-app serialization.
"""
from __future__ import annotations

import random
import threading
from datetime import datetime, timedelta, timezone

from .config import cfg
from . import domain

_LOCK = threading.RLock()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


REVIEW_SNIPPETS = [
    "On-time delivery, material as described.", "Good quality, slightly pricey.",
    "Reliable for bulk orders.", "Packaging could be better but product is fine.",
    "Prompt dispatch and helpful staff.", "Consistent grade across deliveries.",
    "Had a minor delay once, otherwise solid.", "Best rates in the area.",
]
DOC_TYPES = [("GST Certificate", "pdf"), ("ISI/BIS Certificate", "pdf"),
             ("Bank Proof", "pdf"), ("Trade License", "jpg")]


class Store:
    def __init__(self) -> None:
        self.reset()

    # ---------------------------------------------------------------- seed ---
    def reset(self) -> None:
        c = cfg()
        self.cfg = c
        self.rng = random.Random(c["app"].get("random_seed", 42))
        self.pricing = c["pricing"]
        self.logistics_config = dict(c["logistics_config"])
        self.low_thresholds = c["low_stock_thresholds"]

        self.warehouses = {w["id"]: dict(w) for w in c["warehouses"]}
        self.locations = {l["id"]: dict(l) for l in c["locations"]}
        self.materials = {m["id"]: dict(m) for m in c["materials"]}

        self.vendors: dict[str, dict] = {}
        for v in c["vendors"]:
            vv = dict(v)
            vv["offers"] = {mid: dict(o) for mid, o in v["offers"].items()}
            vv["kyc_status"] = "approved" if v.get("approved") else "pending"
            vv["established"] = str(self.rng.randint(1998, 2019))
            vv["rating_count"] = self.rng.randint(18, 260) if v.get("approved") else 0
            vv.setdefault("description", f"{v['tier']} of construction materials in {v.get('city','Hyderabad')}.")
            self.vendors[vv["id"]] = vv

        # users
        self.users: dict[str, dict] = {}
        from .auth import hash_password
        pw = c["demo_password"]
        for u in c["demo_users"]:
            self.users[u["email"].lower()] = {
                "id": u["email"].split("@")[0], "email": u["email"], "name": u["name"],
                "role": u["role"], "vendor": u.get("vendor"),
                "location": u.get("location", "hyderabad"),
                "password_hash": hash_password(pw),
            }

        self.orders: list[dict] = []
        self.views: list[dict] = []
        self.reorders: list[dict] = []
        self._seq = 1000
        self._seed_orders(c["app"].get("seed_orders", 12))

    # --------------------------------------------------------- helpers -------
    def offers_for(self, material: str) -> list[dict]:
        out = []
        for v in self.vendors.values():
            off = v["offers"].get(material)
            if not off:
                continue
            out.append({
                "vendor_id": v["id"], "vendor_name": v["name"], "tier": v["tier"],
                "quality": v["quality"], "isi": v["isi"], "credit": v["credit"],
                "approved": v["approved"], "warehouse_id": v["warehouse"],
                "warehouse_name": self.warehouses[v["warehouse"]]["name"],
                "wh": self.warehouses[v["warehouse"]],
                "unit_price": off["price"], "stock": off["stock"],
            })
        return out

    def dest(self, location: str) -> dict:
        return self.locations.get(location, self.locations["hyderabad"])

    def next_seq(self) -> int:
        self._seq += 1
        return self._seq

    # ---------------------------------------------------------- orders -------
    def _seed_orders(self, n: int) -> None:
        buyers = [("Ramesh Constructions", "+91 98480 10001", "ramesh@build.in", "36ABCDE1111Z1"),
                  ("Sri Venkatesh Builders", "+91 98480 10002", "venkatesh@sv.in", "36ABCDE2222Z2"),
                  ("Lakshmi Infra", "+91 98480 10003", "info@lakshmiinfra.in", "36ABCDE3333Z3"),
                  ("R. Kumar (Individual)", "+91 98480 10004", "rkumar@gmail.com", ""),
                  ("Deccan Developers", "+91 98480 10005", "ops@deccandev.in", "36ABCDE5555Z5")]
        mats = list(self.materials.keys())
        statuses = ["placed", "placed", "dispatched", "dispatched", "delivered", "delivered", "delivered"]
        for i in range(n):
            loc = self.rng.choice(list(self.locations.keys()))
            bn, bp, be, bg = self.rng.choice(buyers)
            k = self.rng.randint(1, 3)
            chosen = self.rng.sample(mats, k)
            items = []
            for mid in chosen:
                qty = max(1, round(self.materials[mid]["qty_hint"] * self.rng.uniform(0.5, 2.5)))
                best = domain.cheapest(self.offers_for(mid), qty, self.dest(loc), mid, self.pricing)
                if not best:
                    continue
                items.append(self._mk_item(mid, qty, best))
            if not items:
                continue
            status = self.rng.choice(statuses)
            created = _now() - timedelta(hours=self.rng.randint(2, 240))
            o = self._mk_order(items, loc, self.rng.choice(["upi", "card", "credit"]),
                               buyer=None, buyer_name=bn, buyer_phone=bp,
                               buyer_email=be, buyer_gstin=bg, created_at=created)
            o["status"] = status
            if status in ("dispatched", "delivered"):
                o["dispatched_at"] = created + timedelta(hours=self.rng.randint(2, 12))
                o["eta_at"] = o["dispatched_at"] + timedelta(hours=self.rng.randint(3, 30))
            if status == "delivered":
                o["delivered_at"] = o["dispatched_at"] + timedelta(hours=self.rng.randint(1, 24))
                o["rating"] = self.rng.choice([0, 4, 5, 4.5, 3.5])
            o["priority"] = "high" if self.rng.random() < 0.3 else "normal"
            self.orders.append(o)
        self.orders.sort(key=lambda x: x["created_at"], reverse=True)

    def _mk_item(self, mid: str, qty: float, best: dict) -> dict:
        m = self.materials[mid]
        return {
            "material": mid, "name": m["name"], "category": m["category"], "unit": m["unit"],
            "vendor_id": best["vendor_id"], "vendor_name": best["vendor_name"],
            "warehouse_id": best["warehouse_id"], "warehouse_name": best["warehouse_name"],
            "quantity": qty, "unit_price": best["unit_price"],
            "landed_cost": round(best["landed_cost"], 2),
        }

    def _mk_order(self, items, location, payment_method, buyer, buyer_name,
                  buyer_phone="", buyer_email="", buyer_gstin="", created_at=None) -> dict:
        seq = self.next_seq()
        total = round(sum(it["landed_cost"] for it in items), 2)
        created = created_at or _now()
        return {
            "id": f"ORD-{seq}", "seq": seq, "buyer_id": buyer, "buyer_name": buyer_name,
            "buyer_phone": buyer_phone, "buyer_email": buyer_email, "buyer_gstin": buyer_gstin,
            "location": location, "address": self.locations.get(location, {}).get("label", location),
            "payment_method": payment_method, "transport": "inbuilt", "status": "placed", "priority": "normal",
            "created_at": created, "dispatched_at": None, "delivered_at": None, "eta_at": None,
            "rating": 0, "proof": None, "proof_type": None, "note": None,
            "items": items, "total": total,
        }

    def create_order(self, items, location, payment_method, buyer_id=None, buyer_name="Demo Buyer") -> dict:
        with _LOCK:
            order = self._mk_order(items, location, payment_method, buyer_id, buyer_name)
            # decrement stock atomically
            for it in items:
                v = self.vendors.get(it["vendor_id"])
                if v and it["material"] in v["offers"]:
                    off = v["offers"][it["material"]]
                    off["stock"] = max(0, int(off["stock"] - it["quantity"]))
            self.orders.insert(0, order)
            return order

    def get_order(self, oid: str) -> dict | None:
        return next((o for o in self.orders if o["id"] == oid or str(o["seq"]) == str(oid)), None)


store = Store()
