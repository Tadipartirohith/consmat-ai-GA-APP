"""Operator (dispatch) app: queue, dispatch, deliver, network stock, reorder, views."""
from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..auth import require_role
from ..store import store, _now
from ..serializers import operator_ticket

router = APIRouter()


@router.get("/operator/dispatch-queue")
def dispatch_queue(_=Depends(require_role("operator", "manager", "admin"))):
    tickets = [operator_ticket(o) for o in store.orders if o["status"] != "cancelled"]
    return {"tickets": tickets}


@router.post("/operator/dispatch/{order_id}")
def dispatch(order_id: str, _=Depends(require_role("operator", "manager", "admin"))):
    o = store.get_order(order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    o["status"] = "dispatched"
    o["dispatched_at"] = o.get("dispatched_at") or _now()
    o["eta_at"] = o["dispatched_at"] + timedelta(hours=6)
    return {"ticket": operator_ticket(o), "status": "dispatched"}


class Proof(BaseModel):
    proof: Optional[str] = None
    proof_type: Optional[str] = None
    note: Optional[str] = None


@router.post("/operator/deliver/{order_id}")
def deliver(order_id: str, body: Proof | None = None, _=Depends(require_role("operator", "manager", "admin"))):
    o = store.get_order(order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    o["status"] = "delivered"
    o["dispatched_at"] = o.get("dispatched_at") or _now()
    o["delivered_at"] = _now()
    if body:
        o["proof"] = body.proof
        o["proof_type"] = body.proof_type
        o["note"] = body.note
    return {"ticket": operator_ticket(o), "status": "delivered"}


@router.get("/operator/network-stock")
def network_stock(_=Depends(require_role("operator", "manager", "admin"))):
    products = []
    for mid, m in store.materials.items():
        vendors = []
        total = 0
        for v in store.vendors.values():
            if not v["approved"]:
                continue
            for okey, off in v["offers"].items():
                if store.offer_material(okey, off) != mid:
                    continue
                total += off["stock"]
                vendors.append({"vendor_id": v["id"], "vendor_name": v["name"],
                                "brand": off.get("brand", ""), "rating": v["quality"],
                                "price": off["price"], "stock": off["stock"]})
        if not vendors:
            continue
        products.append({"product_id": mid, "name": m["name"], "category": m["category"],
                         "unit": m["unit"], "total_available": total, "vendors": vendors})
    return {"products": products}


class ReorderBody(BaseModel):
    product_id: str
    vendor_id: str
    qty: Optional[float] = None


@router.post("/operator/reorder")
def reorder(body: ReorderBody, _=Depends(require_role("operator", "manager", "admin"))):
    v = store.vendors.get(body.vendor_id)
    if not v:
        raise HTTPException(404, "Vendor not found")
    off = v["offers"].get(body.product_id)
    if not off:
        raise HTTPException(404, "Product not stocked by vendor")
    qty = int(body.qty or store.materials.get(body.product_id, {}).get("qty_hint", 100))
    off["stock"] += qty                       # restock into the network
    rid = "RO-" + uuid.uuid4().hex[:8].upper()
    unit = store.materials.get(body.product_id, {}).get("unit", "units")
    store.reorders.append({"reorder_id": rid, "product_id": body.product_id,
                           "vendor_id": body.vendor_id, "qty": qty, "at": _now().isoformat()})
    return {"reorder_id": rid, "qty": qty, "unit": unit, "vendor_name": v["name"]}


@router.get("/operator/views")
def list_views(_=Depends(require_role("operator", "manager", "admin"))):
    return {"views": store.views}


class ViewBody(BaseModel):
    name: str
    filter: str = "all"
    search: str = ""
    sort: str = "newest"
    created_by: Optional[str] = None


@router.post("/operator/views")
def create_view(body: ViewBody, _=Depends(require_role("operator", "manager", "admin"))):
    view = {"id": "vw_" + uuid.uuid4().hex[:8], "name": body.name, "filter": body.filter,
            "search": body.search, "sort": body.sort, "created_by": body.created_by or "operator"}
    store.views.append(view)
    return view


@router.delete("/operator/views/{view_id}")
def delete_view(view_id: str, _=Depends(require_role("operator", "manager", "admin"))):
    store.views = [v for v in store.views if v["id"] != view_id]
    return {"ok": True}
