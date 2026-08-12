"""Auth + catalog endpoints shared by all apps."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import verify_password, make_token, current_user
from ..store import store

router = APIRouter()


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginBody):
    user = store.users.get(body.email.lower())
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(user["email"], user["role"], {"vendor": user.get("vendor")})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user["id"], "email": user["email"], "name": user["name"],
                     "role": user["role"], "vendor_id": user.get("vendor")}}


@router.get("/auth/me")
def me(user: dict = Depends(current_user)):
    return {"id": user["id"], "email": user["email"], "name": user["name"],
            "role": user["role"], "vendor_id": user.get("vendor")}


@router.get("/materials")
def materials():
    out = []
    for m in store.materials.values():
        rating, count = store.product_rating(m["id"])
        out.append({"id": m["id"], "name": m["name"], "category": m["category"], "unit": m["unit"],
                    "grade": m["grade"], "qty_hint": m["qty_hint"], "image_url": m.get("image_url", ""),
                    "rating": rating, "rating_count": count})
    return out


@router.get("/warehouses")
def warehouses():
    return list(store.warehouses.values())


@router.get("/locations")
def locations():
    return list(store.locations.values())
