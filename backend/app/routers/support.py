"""Customer support: complaints raised by buyers/vendors, handled by operators,
escalated operator -> manager -> admin. Order-based or general (out-of-order)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..auth import require_role, current_user
from ..store import store, _now, iso
from ..serializers import complaint_view

router = APIRouter()

SEVERITIES = {"low", "medium", "high", "critical"}
STAFF_ROLES = ("operator", "manager", "admin")
NEXT_LEVEL = {"operator": "manager", "manager": "admin"}


def _vendor_name(user: dict) -> str:
    v = store.vendors.get(user.get("vendor") or "")
    return v["name"] if v else ""


def _vendor_involved(c: dict, user: dict) -> bool:
    snap = c.get("order_snapshot") or {}
    return _vendor_name(user) in (snap.get("vendors") or [])


def _can_see(c: dict, user: dict) -> bool:
    role = user["role"]
    if role in STAFF_ROLES:
        return True
    if c["raised_by"]["email"] == user["email"]:
        return True
    if role == "vendor" and _vendor_involved(c, user):
        return True
    return False


# ------------------------------------------------------- raise a complaint ---
class ComplaintBody(BaseModel):
    subject: str
    description: str
    order_id: Optional[str] = None
    severity: str = "medium"
    target: Optional[str] = None          # vendor | delivery | platform | payment


@router.post("/support/complaints")
def create_complaint(body: ComplaintBody, user: dict = Depends(require_role("buyer", "vendor"))):
    if not body.subject.strip() or not body.description.strip():
        raise HTTPException(400, "Subject and description are required")
    sev = body.severity if body.severity in SEVERITIES else "medium"
    snapshot, order_id = None, None
    if body.order_id:                                   # order-based complaint
        o = store.get_order(body.order_id)
        if not o:
            raise HTTPException(404, "Order not found")
        if user["role"] == "buyer" and o.get("buyer_id") and o["buyer_id"] != user["email"]:
            raise HTTPException(403, "That order isn't yours")
        if user["role"] == "vendor" and not any(it["vendor_id"] == user.get("vendor") for it in o["items"]):
            raise HTTPException(403, "That order isn't yours")
        # only one open complaint per order per person
        if any(c.get("order_id") == o["id"] and c["raised_by"]["email"] == user["email"]
               and c["status"] not in ("resolved", "closed") for c in store.complaints):
            raise HTTPException(409, "You already have an open complaint on this order")
        snapshot, order_id = store.order_snapshot(o), o["id"]
    now = _now()
    cid = store.next_complaint_id()
    c = {
        "id": cid, "order_id": order_id,
        "raised_by": {"role": user["role"], "name": user["name"], "email": user["email"]},
        "target": body.target, "subject": body.subject.strip(), "description": body.description.strip(),
        "severity": sev, "status": "open", "level": "operator", "order_snapshot": snapshot,
        "thread": [{"by": user["name"], "role": user["role"], "at": iso(now),
                    "note": body.description.strip()}],
        "created_at": now, "updated_at": now,
    }
    store.create_complaint(c)
    return complaint_view(c, full=True)


# ------------------------------------------------------------- list / read ---
@router.get("/support/complaints")
def list_complaints(status: Optional[str] = None, user: dict = Depends(current_user)):
    role = user["role"]
    if role in STAFF_ROLES:
        items = list(store.complaints)
    elif role == "vendor":
        items = [c for c in store.complaints
                 if c["raised_by"]["email"] == user["email"] or _vendor_involved(c, user)]
    else:  # buyer
        items = [c for c in store.complaints if c["raised_by"]["email"] == user["email"]]
    if status:
        items = [c for c in items if c["status"] == status]
    return {"complaints": [complaint_view(c) for c in items]}


@router.get("/support/complaints/{cid}")
def get_complaint(cid: str, user: dict = Depends(current_user)):
    c = store.get_complaint(cid)
    if not c:
        raise HTTPException(404, "Complaint not found")
    if not _can_see(c, user):
        raise HTTPException(403, "Not allowed")
    return complaint_view(c, full=True)


# ------------------------------------------------------------- add message ---
class MessageBody(BaseModel):
    note: str


@router.post("/support/complaints/{cid}/messages")
def add_message(cid: str, body: MessageBody, user: dict = Depends(current_user)):
    c = store.get_complaint(cid)
    if not c:
        raise HTTPException(404, "Complaint not found")
    if not _can_see(c, user):
        raise HTTPException(403, "Not allowed")
    if not body.note.strip():
        raise HTTPException(400, "Empty message")
    now = _now()
    c["thread"].append({"by": user["name"], "role": user["role"], "at": iso(now), "note": body.note.strip()})
    c["updated_at"] = now
    if user["role"] in STAFF_ROLES and c["status"] == "open":
        c["status"] = "in_progress"
    return complaint_view(c, full=True)


# --------------------------------------------------------------- escalate ----
class EscalateBody(BaseModel):
    note: Optional[str] = None


@router.post("/support/complaints/{cid}/escalate")
def escalate(cid: str, body: EscalateBody | None = None,
             user: dict = Depends(require_role("operator", "manager"))):
    c = store.get_complaint(cid)
    if not c:
        raise HTTPException(404, "Complaint not found")
    nxt = NEXT_LEVEL.get(user["role"])
    if not nxt:
        raise HTTPException(400, "Cannot escalate further")
    # an operator can only escalate operator-level items; a manager escalates manager-level ones
    if c["level"] != user["role"]:
        raise HTTPException(409, f"This complaint sits at the {c['level']} level")
    c["level"] = nxt
    c["status"] = "escalated"
    now = _now()
    note = (body.note.strip() if body and body.note else "") or f"Escalated to {nxt}."
    c["thread"].append({"by": user["name"], "role": user["role"], "at": iso(now),
                        "note": f"[Escalated to {nxt}] {note}"})
    c["updated_at"] = now
    return complaint_view(c, full=True)


# ---------------------------------------------------------------- status -----
class StatusBody(BaseModel):
    status: str
    note: Optional[str] = None


@router.post("/support/complaints/{cid}/status")
def set_status(cid: str, body: StatusBody, user: dict = Depends(require_role(*STAFF_ROLES))):
    c = store.get_complaint(cid)
    if not c:
        raise HTTPException(404, "Complaint not found")
    allowed = {"in_progress", "resolved", "closed", "open"}
    if body.status not in allowed:
        raise HTTPException(400, "Invalid status")
    c["status"] = body.status
    now = _now()
    if body.note and body.note.strip():
        c["thread"].append({"by": user["name"], "role": user["role"], "at": iso(now), "note": body.note.strip()})
    else:
        c["thread"].append({"by": user["name"], "role": user["role"], "at": iso(now),
                            "note": f"Marked {body.status.replace('_', ' ')}."})
    c["updated_at"] = now
    return complaint_view(c, full=True)


# ---------------------------------------------------------------- metrics ----
@router.get("/support/metrics")
def metrics(_: dict = Depends(require_role(*STAFF_ROLES))):
    by_status: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    by_level: dict[str, int] = {}
    open_count = 0
    for c in store.complaints:
        by_status[c["status"]] = by_status.get(c["status"], 0) + 1
        by_severity[c["severity"]] = by_severity.get(c["severity"], 0) + 1
        by_level[c["level"]] = by_level.get(c["level"], 0) + 1
        if c["status"] not in ("resolved", "closed"):
            open_count += 1
    return {
        "total": len(store.complaints), "open": open_count,
        "ongoing": by_status.get("in_progress", 0) + by_status.get("escalated", 0),
        "closed": by_status.get("resolved", 0) + by_status.get("closed", 0),
        "by_status": by_status, "by_severity": by_severity, "by_level": by_level,
    }
