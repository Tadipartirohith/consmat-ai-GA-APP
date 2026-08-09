"""Admin app endpoints: metrics, orders, vendors, approvals, logistics config."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..auth import require_role
from ..store import store
from ..serializers import admin_order, admin_vendor_summary, admin_vendor_detail

router = APIRouter()


def _parse(d: Optional[str]):
    if not d:
        return None
    try:
        return datetime.fromisoformat(d).replace(tzinfo=timezone.utc)
    except Exception:
        return None


@router.get("/admin/metrics")
def metrics(start: Optional[str] = None, _=Depends(require_role("admin"))):
    s = _parse(start)
    orders = [o for o in store.orders if not s or o["created_at"] >= s]
    gmv = round(sum(o["total"] for o in orders if o["status"] != "cancelled"), 2)
    active = sum(1 for v in store.vendors.values() if v["approved"])
    pending = sum(1 for v in store.vendors.values() if not v["approved"])
    return {"gmv": gmv, "orders": len(orders), "active_vendors": active, "pending_kyc": pending}


@router.get("/admin/orders")
def orders(start: Optional[str] = None, end: Optional[str] = None, _=Depends(require_role("admin"))):
    s, e = _parse(start), _parse(end)
    out = []
    for o in store.orders:
        if s and o["created_at"] < s:
            continue
        if e and o["created_at"] > e:
            continue
        out.append(admin_order(o))
    return out


@router.get("/admin/vendors")
def vendors(_=Depends(require_role("admin"))):
    return [admin_vendor_summary(v) for v in store.vendors.values()]


@router.get("/admin/vendors/{vendor_id}")
def vendor_detail(vendor_id: str, _=Depends(require_role("admin"))):
    v = store.vendors.get(vendor_id)
    if not v:
        raise HTTPException(404, "Vendor not found")
    return admin_vendor_detail(v)


@router.post("/admin/vendors/{vendor_id}/approve")
def approve(vendor_id: str, _=Depends(require_role("admin"))):
    v = store.vendors.get(vendor_id)
    if not v:
        raise HTTPException(404, "Vendor not found")
    v["approved"] = True
    v["kyc_status"] = "approved"
    if v["quality"] == 0:
        v["quality"] = 3.8
    return {"id": v["id"], "name": v["name"], "kyc_status": "approved"}


class BulkBody(BaseModel):
    ids: list[str]


@router.post("/admin/vendors/bulk-approve")
def bulk_approve(body: BulkBody, _=Depends(require_role("admin"))):
    n = 0
    for vid in body.ids:
        v = store.vendors.get(vid)
        if v and not v["approved"]:
            v["approved"] = True
            v["kyc_status"] = "approved"
            if v["quality"] == 0:
                v["quality"] = 3.8
            n += 1
    return {"approved": n}


@router.get("/admin/logistics-config")
def get_config(_=Depends(require_role("admin"))):
    return dict(store.logistics_config)


@router.put("/admin/logistics-config")
def update_config(body: dict, _=Depends(require_role("admin"))):
    store.logistics_config.update(body)
    # keep the live pricing engine in sync with the editable knobs
    if "rate_per_km" in body:
        store.pricing["rate_per_km"] = body["rate_per_km"]
    if "handling_fee" in body:
        store.pricing["handling"] = body["handling_fee"]
    if "quality_gate" in body:
        store.pricing["quality_gate"] = body["quality_gate"]
    return dict(store.logistics_config)
