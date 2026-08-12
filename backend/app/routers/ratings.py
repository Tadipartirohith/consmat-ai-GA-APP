"""Ratings: buyers rate vendors and products, vendors rate products. Admin can
edit/hide any rating and set an override for transparency."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..auth import require_role, optional_user
from ..store import store, _now, iso

router = APIRouter()


def _rating_view(r: dict) -> dict:
    return {
        "id": r["id"], "kind": r["kind"], "target_id": r["target_id"],
        "target_name": r.get("target_name", ""), "stars": r["stars"], "comment": r.get("comment", ""),
        "by": r.get("by", {}), "order_id": r.get("order_id"), "hidden": bool(r.get("hidden")),
        "created_at": iso(r["created_at"]),
    }


KINDS = ("vendor", "product", "delivery", "care")


class RatingBody(BaseModel):
    kind: str                       # vendor | product | delivery | care
    target_id: str
    stars: int
    comment: Optional[str] = ""
    order_id: Optional[str] = None


@router.post("/ratings")
def create_rating(body: RatingBody, user: dict = Depends(require_role("buyer"))):
    # Only customers rate. Vendors can raise complaints, not ratings.
    if body.kind not in KINDS:
        raise HTTPException(400, f"kind must be one of {KINDS}")
    if not (1 <= int(body.stars) <= 5):
        raise HTTPException(400, "stars must be 1-5")
    if body.kind == "vendor":
        target = store.vendors.get(body.target_id)
        if not target:
            raise HTTPException(404, "Vendor not found")
        tname = target["name"]
    elif body.kind == "product":
        target = store.materials.get(body.target_id)
        if not target:
            raise HTTPException(404, "Material not found")
        tname = target["name"]
    elif body.kind == "delivery":
        tname = f"Delivery · {body.target_id}"
    else:  # care
        tname = f"Customer care · {body.target_id}"
    r = {
        "id": store.next_rating_id(), "kind": body.kind, "target_id": body.target_id,
        "target_name": tname, "stars": int(body.stars), "comment": (body.comment or "").strip(),
        "by": {"role": user["role"], "name": user["name"], "email": user["email"]},
        "order_id": body.order_id, "hidden": False, "created_at": _now(),
    }
    store.create_rating(r)
    return _rating_view(r)


@router.get("/ratings")
def list_ratings(kind: str, target_id: str, user: dict | None = Depends(optional_user)):
    active = [r for r in store.ratings if r["kind"] == kind and r["target_id"] == target_id and not r.get("hidden")]
    return {"summary": store.rating_summary(kind, target_id),
            "ratings": [_rating_view(r) for r in active]}


@router.get("/products/ratings")
def product_ratings():
    """Compact map of material_id -> {average, count} for shop display."""
    out = {}
    for mid in store.materials:
        avg, count = store.product_rating(mid)
        out[mid] = {"average": avg, "count": count}
    return out


# ------------------------------------------------------------ moderation -----
class ModerateBody(BaseModel):
    stars: Optional[int] = None
    comment: Optional[str] = None
    hidden: Optional[bool] = None


MODERATORS = ("admin", "manager")


@router.get("/moderation/ratings")
def list_ratings_for_moderation(kind: Optional[str] = None, _=Depends(require_role(*MODERATORS))):
    items = store.ratings if not kind else [r for r in store.ratings if r["kind"] == kind]
    return [_rating_view(r) for r in items]


@router.get("/moderation/ratings/overview")
def ratings_overview(_=Depends(require_role(*MODERATORS))):
    def agg(kind):
        rs = [r["stars"] for r in store.ratings if r["kind"] == kind and not r.get("hidden")]
        return {"average": round(sum(rs) / len(rs), 1) if rs else None, "count": len(rs)}
    hidden = sum(1 for r in store.ratings if r.get("hidden"))
    return {"total": len(store.ratings), "hidden": hidden,
            "vendor": agg("vendor"), "product": agg("product"),
            "delivery": agg("delivery"), "care": agg("care")}


@router.put("/moderation/ratings/{rid}")
def admin_moderate(rid: str, body: ModerateBody, _=Depends(require_role(*MODERATORS))):
    r = store.get_rating(rid)
    if not r:
        raise HTTPException(404, "Rating not found")
    if body.stars is not None:
        if not (1 <= int(body.stars) <= 5):
            raise HTTPException(400, "stars must be 1-5")
        r["stars"] = int(body.stars)
    if body.comment is not None:
        r["comment"] = body.comment.strip()
    if body.hidden is not None:
        r["hidden"] = bool(body.hidden)
    r["moderated"] = True
    return _rating_view(r)


class OverrideBody(BaseModel):
    value: Optional[float] = None   # None clears the override


@router.put("/moderation/vendors/{vendor_id}/rating-override")
def vendor_override(vendor_id: str, body: OverrideBody, _=Depends(require_role(*MODERATORS))):
    v = store.vendors.get(vendor_id)
    if not v:
        raise HTTPException(404, "Vendor not found")
    if body.value is None:
        v.pop("rating_override", None)
    else:
        v["rating_override"] = max(0.0, min(5.0, float(body.value)))
    avg, count = store.vendor_rating(vendor_id)
    return {"id": vendor_id, "rating": avg, "override": v.get("rating_override")}


@router.put("/moderation/materials/{material_id}/rating-override")
def material_override(material_id: str, body: OverrideBody, _=Depends(require_role(*MODERATORS))):
    m = store.materials.get(material_id)
    if not m:
        raise HTTPException(404, "Material not found")
    if body.value is None:
        m.pop("rating_override", None)
    else:
        m["rating_override"] = max(0.0, min(5.0, float(body.value)))
    avg, count = store.product_rating(material_id)
    return {"id": material_id, "rating": avg, "override": m.get("rating_override")}
