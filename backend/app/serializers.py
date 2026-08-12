"""Per-app serialization: maps the single internal order/vendor model into the
exact field names and shapes each frontend consumes."""
from __future__ import annotations

from datetime import timedelta

from .store import store, iso, _now, REVIEW_SNIPPETS, DOC_TYPES

# Internal status -> each app's vocabulary -----------------------------------
ADMIN_STATUS = {"placed": "processing", "dispatched": "in_transit",
                "delivered": "delivered", "cancelled": "cancelled"}
VENDOR_STATUS = {"placed": "pending", "dispatched": "accepted",
                 "delivered": "fulfilled", "cancelled": "cancelled"}
OPERATOR_STATUS = {"placed": "pending", "dispatched": "dispatched",
                   "delivered": "delivered", "cancelled": "cancelled"}


# ============================ BUYER ============================
def buyer_order(o: dict) -> dict:
    return {
        "order_id": o["id"], "status": o["status"], "total": o["total"],
        "payment_method": o["payment_method"], "address": o["address"],
        "items": [{"material": it["name"], "material_id": it["material"], "vendor": it["vendor_name"],
                   "vendor_id": it["vendor_id"], "quantity": it["quantity"], "unit": it["unit"],
                   "price": it["landed_cost"]} for it in o["items"]],
        "placed_at": iso(o["created_at"]),
        "dispatched_at": iso(o.get("dispatched_at")),
        "delivered_at": iso(o.get("delivered_at")),
    }


# ============================ ADMIN ============================
def admin_order(o: dict) -> dict:
    primary = o["items"][0] if o["items"] else {}
    tl = [
        {"key": "placed", "label": "Order placed", "done": True, "at": iso(o["created_at"])},
        {"key": "dispatched", "label": "Dispatched", "done": o["status"] in ("dispatched", "delivered"),
         "at": iso(o.get("dispatched_at"))},
        {"key": "delivered", "label": "Delivered", "done": o["status"] == "delivered",
         "at": iso(o.get("delivered_at"))},
    ]
    if o["status"] == "cancelled":
        tl = [{"key": "cancelled", "label": "Cancelled", "done": True, "at": iso(o["created_at"])}]
    return {
        "id": o["id"], "status": ADMIN_STATUS.get(o["status"], o["status"]),
        "created_at": iso(o["created_at"]), "amount": o["total"],
        "item": primary.get("name", "—") + (f" +{len(o['items'])-1}" if len(o["items"]) > 1 else ""),
        "vendor": primary.get("vendor_name", "—"), "buyer": o["buyer_name"],
        "rating": o.get("rating", 0),
        "line_items": [{"name": it["name"], "qty": it["quantity"], "unit": it["unit"],
                        "unit_price": it["unit_price"], "amount": it["landed_cost"]}
                       for it in o["items"]],
        "timeline": tl,
        "buyer_contact": {"contact": o["buyer_name"], "phone": o["buyer_phone"],
                          "email": o["buyer_email"], "address": o["address"],
                          "gstin": o["buyer_gstin"]},
    }


def admin_vendor_summary(v: dict) -> dict:
    gmv = _vendor_gmv(v["id"])
    return {
        "id": v["id"], "name": v["name"], "category": v.get("category", v["tier"]),
        "city": v.get("city", ""), "contact": v.get("phone", ""),
        "rating": v["quality"], "gmv": gmv, "kyc_status": v["kyc_status"],
        "orders": _vendor_order_count(v["id"]), "phone": v.get("phone", ""),
        "gstin": v.get("gstin", ""),
    }


def admin_vendor_detail(v: dict) -> dict:
    rng = store.rng
    total = v.get("rating_count", 0) or 40
    # deterministic-ish breakdown weighted toward the rating
    hi = int(total * 0.6); mid = int(total * 0.25); lo = total - hi - mid
    breakdown = {"5": hi, "4": mid, "3": max(0, lo - 2), "2": 1, "1": 1}
    reviews = [{"buyer": f"Buyer {i+1}", "rating": (5 if i % 3 else 4),
                "comment": REVIEW_SNIPPETS[(hash(v["id"]) + i) % len(REVIEW_SNIPPETS)],
                "date": iso(_now() - timedelta(days=(i + 1) * 9))} for i in range(4)]
    documents = [{"name": n, "type": t, "size_kb": 120 + i * 45,
                  "status": "verified" if v["approved"] else "pending"}
                 for i, (n, t) in enumerate(DOC_TYPES)]
    history = [admin_order(o) for o in store.orders
               if any(it["vendor_id"] == v["id"] for it in o["items"])][:6]
    order_history = [{"id": h["id"], "item": h["item"], "amount": h["amount"], "status": h["status"]}
                     for h in history]
    s = admin_vendor_summary(v)
    s.update({
        "rating_count": v.get("rating_count", total), "established": v.get("established", "2010"),
        "email": f"{v['id'].replace('v_','')}@vendor.consmat.in", "address": f"{v.get('city','')}, Telangana",
        "rating_breakdown": breakdown, "reviews": reviews, "documents": documents,
        "order_history": order_history, "description": v.get("description", ""),
    })
    return s


# ============================ VENDOR ============================
def vendor_profile(v: dict) -> dict:
    offers = []
    for okey, off in v["offers"].items():
        rmid = store.offer_material(okey, off)
        m = store.materials.get(rmid, {})
        offers.append({"id": okey, "material": rmid, "brand": off.get("brand", ""),
                       "name": off.get("name") or m.get("name", rmid),
                       "price": off["price"], "stock": off["stock"],
                       "category": off.get("category") or m.get("category", "Custom"),
                       "unit": off.get("unit") or m.get("unit", "units"),
                       "image_url": off.get("image_url") or m.get("image_url", "")})
    return {"vendor": {
        "id": v["id"], "name": v["name"], "email": f"{v['id'].replace('v_','')}@vendor.consmat.in",
        "phone": v.get("phone", ""), "category": v.get("category", v["tier"]),
        "location": v.get("city", ""), "description": v.get("description", ""),
        "rating": v["quality"], "verified": v["approved"], "offers": offers,
    }}


def vendor_order(o: dict, vendor_id: str) -> dict:
    mine = [it for it in o["items"] if it["vendor_id"] == vendor_id]
    hist = [
        {"status": "placed", "at": iso(o["created_at"]), "note": "Order received"},
    ]
    if o["status"] in ("dispatched", "delivered"):
        hist.append({"status": "accepted", "at": iso(o.get("dispatched_at")), "note": "Accepted & dispatched"})
    if o["status"] == "delivered":
        hist.append({"status": "fulfilled", "at": iso(o.get("delivered_at")), "note": "Delivered"})
    return {
        "id": o["id"], "status": VENDOR_STATUS.get(o["status"], o["status"]),
        "total": round(sum(it["landed_cost"] for it in mine), 2),
        "created_at": iso(o["created_at"]), "customer_name": o["buyer_name"],
        "customer_phone": o["buyer_phone"], "address": o["address"],
        "items": [{"name": it["name"], "quantity": it["quantity"], "price": it["landed_cost"],
                   "category": it["category"]} for it in mine],
        "status_history": hist,
    }


# ============================ OPERATOR ============================
def operator_ticket(o: dict) -> dict:
    by_vendor: dict[str, dict] = {}
    for it in o["items"]:
        b = by_vendor.setdefault(it["vendor_id"], {
            "vendor_id": it["vendor_id"], "vendor_name": it["vendor_name"],
            "rating": store.vendors.get(it["vendor_id"], {}).get("quality", 4.0),
            "subtotal": 0.0, "items": []})
        b["items"].append({"name": it["name"], "qty": it["quantity"],
                           "unit": it["unit"], "price": it["landed_cost"]})
        b["subtotal"] = round(b["subtotal"] + it["landed_cost"], 2)
    overdue = bool(o.get("eta_at") and o["status"] == "dispatched" and o["eta_at"] < _now())
    return {
        "order_id": o["id"], "status": OPERATOR_STATUS.get(o["status"], o["status"]),
        "priority": o.get("priority", "normal"), "placed_at": iso(o["created_at"]),
        "total": o["total"], "overdue": overdue, "eta_at": iso(o.get("eta_at")),
        "vendor_count": len(by_vendor), "item_count": len(o["items"]),
        "customer": {"name": o["buyer_name"], "address": o["address"], "phone": o["buyer_phone"]},
        "vendors": list(by_vendor.values()),
        "proof": o.get("proof"), "proof_type": o.get("proof_type"), "note": o.get("note"),
    }


# ============================ SUPPORT / COMPLAINTS ============================
def complaint_view(c: dict, full: bool = False) -> dict:
    out = {
        "id": c["id"], "order_id": c.get("order_id"),
        "subject": c["subject"], "description": c["description"],
        "severity": c["severity"], "status": c["status"], "level": c["level"],
        "target": c.get("target"), "raised_by": c["raised_by"],
        "created_at": iso(c["created_at"]), "updated_at": iso(c.get("updated_at")),
        "message_count": len(c.get("thread", [])),
        "is_order_based": bool(c.get("order_id")),
    }
    if full:
        out["thread"] = c.get("thread", [])
        out["order_snapshot"] = c.get("order_snapshot")
    return out


# ------------------------------- helpers ------------------------------------
def _vendor_gmv(vid: str) -> float:
    return round(sum(it["landed_cost"] for o in store.orders if o["status"] != "cancelled"
                     for it in o["items"] if it["vendor_id"] == vid), 2)


def _vendor_order_count(vid: str) -> int:
    return sum(1 for o in store.orders if any(it["vendor_id"] == vid for it in o["items"]))
