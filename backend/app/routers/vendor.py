"""Vendor app endpoints: register, profile, offers (create/update), orders, status."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..auth import require_role, make_token, hash_password
from ..store import store, _now
from ..serializers import vendor_profile, vendor_order
from .buyer import resolve_material

router = APIRouter()


class VendorRegister(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = ""
    category: Optional[str] = ""
    location: Optional[str] = ""
    description: Optional[str] = ""


@router.post("/vendors/register")
def register(body: VendorRegister):
    if body.email.lower() in store.users:
        raise HTTPException(409, "Email already registered")
    vid = "v_" + re.sub(r"[^a-z0-9]+", "", body.name.lower())[:16] + str(len(store.vendors) + 1)
    store.vendors[vid] = {
        "id": vid, "name": body.name, "tier": "Trader", "category": body.category or "General",
        "quality": 0.0, "isi": False, "credit": "Cash", "city": body.location or "",
        "phone": body.phone or "", "gstin": "", "warehouse": store.logistics_config["default_dispatch_hub"],
        "approved": False, "kyc_status": "pending", "established": "2024", "rating_count": 0,
        "description": body.description or "", "offers": {},
    }
    store.users[body.email.lower()] = {
        "id": body.email.split("@")[0], "email": body.email, "name": body.name,
        "role": "vendor", "vendor": vid, "location": body.location or "hyderabad",
        "password_hash": hash_password(body.password),
    }
    token = make_token(body.email, "vendor", {"vendor": vid})
    return {"access_token": token, "user": {"email": body.email, "name": body.name,
                                            "role": "vendor", "vendor_id": vid}}


@router.get("/vendors/me")
def vendors_me(user: dict = Depends(require_role("vendor"))):
    v = store.vendors.get(user["vendor"])
    if not v:
        raise HTTPException(404, "Vendor profile not found")
    return vendor_profile(v)


class OfferBody(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    price: float
    stock: int
    category: Optional[str] = None
    image_url: Optional[str] = None


def _offer_key(body: OfferBody) -> str:
    if body.id and body.id in store.materials:
        return body.id
    mid = resolve_material(body.name or body.id or "")
    if mid:
        return mid
    if body.id:
        return body.id
    return "custom_" + re.sub(r"[^a-z0-9]+", "", (body.name or "item").lower())[:16]


@router.post("/vendors/me/offers")
def create_offer(body: OfferBody, user: dict = Depends(require_role("vendor"))):
    v = store.vendors[user["vendor"]]
    key = _offer_key(body)
    v["offers"][key] = {"price": float(body.price), "stock": int(body.stock),
                        "name": body.name, "category": body.category,
                        "image_url": body.image_url}
    return {"ok": True, "id": key}


@router.put("/vendors/me/offers")
def update_offer(body: OfferBody, user: dict = Depends(require_role("vendor"))):
    v = store.vendors[user["vendor"]]
    key = body.id if (body.id and body.id in v["offers"]) else _offer_key(body)
    existing = v["offers"].get(key, {})
    v["offers"][key] = {**existing, "price": float(body.price), "stock": int(body.stock),
                        "name": body.name or existing.get("name"),
                        "category": body.category or existing.get("category"),
                        "image_url": body.image_url or existing.get("image_url")}
    return {"ok": True, "id": key}


@router.get("/vendors/me/orders")
def vendor_orders(user: dict = Depends(require_role("vendor"))):
    vid = user["vendor"]
    out = [vendor_order(o, vid) for o in store.orders
           if any(it["vendor_id"] == vid for it in o["items"])]
    return {"orders": out}


class StatusBody(BaseModel):
    status: str
    note: Optional[str] = None


@router.put("/vendors/me/orders/{order_id}")
def update_order_status(order_id: str, body: StatusBody, user: dict = Depends(require_role("vendor"))):
    o = store.get_order(order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    s = body.status.lower()
    if "accept" in s and o["status"] == "placed":
        o["status"] = "dispatched"
        o["dispatched_at"] = o.get("dispatched_at") or _now()
    elif "fulfil" in s or "deliver" in s or "complet" in s:
        o["status"] = "delivered"
        o["dispatched_at"] = o.get("dispatched_at") or _now()
        o["delivered_at"] = o.get("delivered_at") or _now()
    elif "cancel" in s or "reject" in s:
        o["status"] = "cancelled"
    return vendor_order(o, user["vendor"])
