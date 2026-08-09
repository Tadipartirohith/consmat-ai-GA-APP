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


class RejectBody(BaseModel):
    reason: Optional[str] = None


@router.post("/admin/vendors/{vendor_id}/reject")
def reject(vendor_id: str, body: Optional[RejectBody] = None, _=Depends(require_role("admin"))):
    """Reject a KYC request, or revoke an already-approved vendor. Either way the
    vendor is left un-approved (so it drops out of buyer search) and marked rejected."""
    v = store.vendors.get(vendor_id)
    if not v:
        raise HTTPException(404, "Vendor not found")
    was_approved = v["approved"]
    v["approved"] = False
    v["kyc_status"] = "rejected"
    v["reject_reason"] = (body.reason if body else None) or "Rejected by admin"
    return {"id": v["id"], "name": v["name"], "kyc_status": "rejected",
            "was_approved": was_approved}


@router.post("/admin/vendors/{vendor_id}/revoke")
def revoke(vendor_id: str, _=Depends(require_role("admin"))):
    """Send an approved vendor back to pending KYC (soft un-approve, keeps the record)."""
    v = store.vendors.get(vendor_id)
    if not v:
        raise HTTPException(404, "Vendor not found")
    v["approved"] = False
    v["kyc_status"] = "pending"
    v.pop("reject_reason", None)
    return {"id": v["id"], "name": v["name"], "kyc_status": "pending"}


class AddVendorBody(BaseModel):
    name: str
    category: Optional[str] = "General"
    city: Optional[str] = ""
    phone: Optional[str] = ""
    tier: Optional[str] = "Trader"
    quality: Optional[float] = 3.8
    isi: Optional[bool] = False
    credit: Optional[str] = "Cash"
    approved: Optional[bool] = True


@router.post("/admin/vendors")
def add_vendor(body: AddVendorBody, _=Depends(require_role("admin"))):
    import re as _re
    base = _re.sub(r"[^a-z0-9]+", "", body.name.lower())[:16] or "vendor"
    vid = "v_" + base + str(len(store.vendors) + 1)
    store.vendors[vid] = {
        "id": vid, "name": body.name, "tier": body.tier or "Trader",
        "category": body.category or "General", "quality": float(body.quality or 0.0),
        "isi": bool(body.isi), "credit": body.credit or "Cash", "city": body.city or "",
        "phone": body.phone or "", "gstin": "",
        "warehouse": store.logistics_config["default_dispatch_hub"],
        "approved": bool(body.approved), "kyc_status": "approved" if body.approved else "pending",
        "established": "2024", "rating_count": 0,
        "description": f"{body.tier or 'Trader'} of construction materials in {body.city or 'Hyderabad'}.",
        "offers": {},
    }
    return admin_vendor_detail(store.vendors[vid])


@router.delete("/admin/vendors/{vendor_id}")
def remove_vendor(vendor_id: str, _=Depends(require_role("admin"))):
    v = store.vendors.pop(vendor_id, None)
    if not v:
        raise HTTPException(404, "Vendor not found")
    # also drop any login tied to this vendor so it can't come back as a ghost
    for email in [e for e, u in store.users.items() if u.get("vendor") == vendor_id]:
        store.users.pop(email, None)
    return {"removed": vendor_id, "name": v["name"]}


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
