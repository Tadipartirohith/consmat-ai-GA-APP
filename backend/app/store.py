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
        self.complaints: list[dict] = []
        self.ratings: list[dict] = []
        self._seq = 1000
        self._cseq = 5000
        self._rseq = 7000
        self._seed_orders(c["app"].get("seed_orders", 12))
        self._seed_complaints()
        self._seed_ratings()

    # --------------------------------------------------------- helpers -------
    @staticmethod
    def offer_material(okey: str, off: dict) -> str:
        """A vendor can carry several brands of a material via keys like
        'cement#acc'; the material is stored on the offer or is the key prefix."""
        return off.get("material") or okey.split("#")[0]

    def offers_for(self, material: str) -> list[dict]:
        out = []
        for v in self.vendors.values():
            vr = vc = None
            for okey, off in v["offers"].items():
                if self.offer_material(okey, off) != material:
                    continue
                if vr is None:
                    vr, vc = self.vendor_rating(v["id"])
                out.append({
                    "vendor_id": v["id"], "vendor_name": v["name"], "tier": v["tier"],
                    "quality": vr, "rating_count": vc, "isi": v["isi"], "credit": v["credit"],
                    "approved": v["approved"], "warehouse_id": v["warehouse"],
                    "warehouse_name": self.warehouses[v["warehouse"]]["name"],
                    "wh": self.warehouses[v["warehouse"]],
                    "unit_price": off["price"], "stock": off["stock"],
                    "brand": off.get("brand", ""), "offer_key": okey,
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
            "offer_key": best.get("offer_key", mid), "brand": best.get("brand", ""),
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
            # decrement stock atomically on the exact offer (brand) that was ordered
            for it in items:
                v = self.vendors.get(it["vendor_id"])
                if not v:
                    continue
                okey = it.get("offer_key") or it["material"]
                off = v["offers"].get(okey) or v["offers"].get(it["material"])
                if off:
                    off["stock"] = max(0, int(off["stock"] - it["quantity"]))
            self.orders.insert(0, order)
            return order

    def get_order(self, oid: str) -> dict | None:
        return next((o for o in self.orders if o["id"] == oid or str(o["seq"]) == str(oid)), None)

    # ---------------------------------------------------- complaints ---------
    def next_complaint_id(self) -> str:
        self._cseq += 1
        return f"CMP-{self._cseq}"

    def order_snapshot(self, o: dict) -> dict:
        """Frozen order context attached to an order-based complaint."""
        vendors = sorted({it["vendor_name"] for it in o["items"]})
        return {
            "order_id": o["id"], "status": o["status"], "total": o["total"],
            "placed_at": iso(o["created_at"]), "address": o.get("address", ""),
            "buyer": {"name": o["buyer_name"], "phone": o.get("buyer_phone", ""),
                      "email": o.get("buyer_email", "")},
            "vendors": vendors,
            "items": [{"name": it["name"], "quantity": it["quantity"], "unit": it["unit"],
                       "vendor": it["vendor_name"], "amount": it["landed_cost"]} for it in o["items"]],
        }

    def create_complaint(self, c: dict) -> dict:
        with _LOCK:
            self.complaints.insert(0, c)
            return c

    def get_complaint(self, cid: str) -> dict | None:
        return next((c for c in self.complaints if c["id"] == cid), None)

    # ------------------------------------------------------ ratings ----------
    def next_rating_id(self) -> str:
        self._rseq += 1
        return f"RAT-{self._rseq}"

    def create_rating(self, r: dict) -> dict:
        with _LOCK:
            self.ratings.insert(0, r)
            return r

    def get_rating(self, rid: str) -> dict | None:
        return next((r for r in self.ratings if r["id"] == rid), None)

    def _active_ratings(self, kind: str, target_id: str) -> list[dict]:
        return [r for r in self.ratings
                if r["kind"] == kind and r["target_id"] == target_id and not r.get("hidden")]

    def vendor_rating(self, vid: str) -> tuple[float, int]:
        """Effective vendor rating: admin override, else buyer average, else seed quality."""
        v = self.vendors.get(vid, {})
        rs = [r["stars"] for r in self._active_ratings("vendor", vid)]
        if v.get("rating_override") is not None:
            return round(float(v["rating_override"]), 1), len(rs)
        if rs:
            return round(sum(rs) / len(rs), 1), len(rs)
        return round(float(v.get("quality", 0.0)), 1), 0

    def product_rating(self, mid: str) -> tuple[float | None, int]:
        m = self.materials.get(mid, {})
        rs = [r["stars"] for r in self._active_ratings("product", mid)]
        if m.get("rating_override") is not None:
            return round(float(m["rating_override"]), 1), len(rs)
        if rs:
            return round(sum(rs) / len(rs), 1), len(rs)
        return None, 0

    def rating_summary(self, kind: str, target_id: str) -> dict:
        active = self._active_ratings(kind, target_id)
        breakdown = {str(s): sum(1 for r in active if round(r["stars"]) == s) for s in range(5, 0, -1)}
        if kind == "vendor":
            avg, count = self.vendor_rating(target_id)
        else:
            avg, count = self.product_rating(target_id)
        return {"average": avg, "count": len(active), "effective_count": count, "breakdown": breakdown}

    def _seed_ratings(self) -> None:
        vend = [("v_deccan", 5, "Reliable, on-time."), ("v_ultrabuild", 5, "Top grade cement."),
                ("v_balaji", 4, "Cheapest around, packaging could be better."), ("v_metro", 4, "Good steel, fair price.")]
        for vid, stars, comment in vend:
            v = self.vendors.get(vid)
            if not v:
                continue
            self.ratings.append({
                "id": self.next_rating_id(), "kind": "vendor", "target_id": vid,
                "target_name": v["name"], "stars": stars, "comment": comment,
                "by": {"role": "buyer", "name": "Ramesh Constructions", "email": "ramesh@build.in"},
                "order_id": None, "hidden": False,
                "created_at": _now() - timedelta(days=self.rng.randint(1, 20)),
            })
        prod = [("cement", 5, "Sets well, consistent."), ("steel", 4, "Good bend strength."),
                ("bricks", 4, "Uniform size.")]
        for mid, stars, comment in prod:
            m = self.materials.get(mid)
            if not m:
                continue
            self.ratings.append({
                "id": self.next_rating_id(), "kind": "product", "target_id": mid,
                "target_name": m["name"], "stars": stars, "comment": comment,
                "by": {"role": "buyer", "name": "Sri Venkatesh Builders", "email": "venkatesh@sv.in"},
                "order_id": None, "hidden": False,
                "created_at": _now() - timedelta(days=self.rng.randint(1, 20)),
            })

    def _seed_complaints(self) -> None:
        placed = [o for o in self.orders if o["status"] in ("dispatched", "delivered")]
        samples = [
            ("Delivery running late", "The truck hasn't arrived and the ETA has passed. Need an update.",
             "high", "in_progress", "operator", "delivery"),
            ("Short quantity received", "Received fewer bags than ordered. Please reconcile.",
             "critical", "escalated", "manager", "vendor"),
            ("Damaged bags on delivery", "A few cement bags were torn on arrival.",
             "medium", "open", "operator", "vendor"),
        ]
        for i, (subj, desc, sev, status, level, target) in enumerate(samples):
            o = placed[i] if i < len(placed) else None
            cid = self.next_complaint_id()
            created = _now() - timedelta(hours=self.rng.randint(2, 60))
            thread = [{"by": (o["buyer_name"] if o else "Ramesh Constructions"), "role": "buyer",
                       "at": iso(created), "note": desc}]
            if status in ("in_progress", "escalated"):
                thread.append({"by": "Hub Operator", "role": "operator",
                               "at": iso(created + timedelta(hours=1)),
                               "note": "Looking into this and coordinating with the vendor."})
            if status == "escalated":
                thread.append({"by": "Hub Operator", "role": "operator",
                               "at": iso(created + timedelta(hours=2)),
                               "note": "Escalating to manager after the call with the buyer."})
            self.complaints.append({
                "id": cid, "order_id": o["id"] if o else None,
                "raised_by": {"role": "buyer", "name": o["buyer_name"] if o else "Ramesh Constructions",
                              "email": o.get("buyer_email", "") if o else "ramesh@build.in"},
                "target": target, "subject": subj, "description": desc,
                "severity": sev, "status": status, "level": level,
                "order_snapshot": self.order_snapshot(o) if o else None,
                "thread": thread, "created_at": created,
                "updated_at": created + timedelta(hours=2 if status != "open" else 0),
            })
        self.complaints.sort(key=lambda c: c["created_at"], reverse=True)


store = Store()
