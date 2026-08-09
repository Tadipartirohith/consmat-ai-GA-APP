"""Buyer app endpoints: match, ai/chat, estimate, optimize, checkout, orders."""
from __future__ import annotations

import re
import os
import json

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Any

from ..store import store, iso, _now
from ..auth import optional_user
from .. import domain
from ..serializers import buyer_order

router = APIRouter()


# ------------------------------------------------------------ helpers -------
def resolve_material(name_or_id: str) -> Optional[str]:
    if not name_or_id:
        return None
    key = str(name_or_id).strip().lower()
    if key in store.materials:
        return key
    for mid, m in store.materials.items():
        if m["name"].lower() == key or key in m["name"].lower():
            return mid
    # loose keyword match
    kw = {"cement": "cement", "steel": "steel", "tmt": "steel", "sand": "sand",
          "aggregate": "aggregate", "gravel": "aggregate", "brick": "bricks"}
    for k, v in kw.items():
        if k in key:
            return v
    return None


def _why(rows, r) -> str:
    cheapest = min(rows, key=lambda x: x["landed_cost"])
    q = r["quality"]
    if r["rank"] == 1 and r is cheapest:
        return "Cheapest landed price and clears the quality bar"
    if r["rank"] == 1:
        return f"A bit pricier than cheapest, but {q:.1f}★ quality wins on value"
    if r is cheapest:
        return f"Lowest sticker price — {q:.1f}★ quality ranks it below #1"
    return f"{r['distance_km']}km delivery + {q:.1f}★ quality"


def match_cards(material_id: str, quantity: float, location: str, pq: int) -> list[dict]:
    m = store.materials[material_id]
    qty = quantity or m["qty_hint"]
    rows = domain.rank_vendors(store.offers_for(material_id), qty, store.dest(location),
                               pq, material_id, store.pricing)
    out = []
    for r in rows:
        out.append({
            "vendor": r["vendor_name"], "vendor_id": r["vendor_id"], "material": m["name"],
            "quantity": qty, "unit": m["unit"], "landed_price": r["landed_cost"],
            "material_cost": r["material_cost"], "logistics_cost": r["logistics_cost"],
            "quality": r["quality"], "warehouse": r["warehouse_name"],
            "distance": r["distance_km"], "why": _why(rows, r),
            "price_per_unit": r["unit_price"], "rank": r["rank"], "in_stock": r["in_stock"],
            "credit": r["credit"], "isi": r["isi"], "tier": r["tier"],
        })
    return out


# ------------------------------------------------------------ /match --------
class MatchBody(BaseModel):
    material: str
    quantity: Optional[float] = None
    location: str = "hyderabad"
    price_quality: int = 35


@router.post("/match")
def match(body: MatchBody):
    mid = resolve_material(body.material)
    if not mid:
        return {"vendors": [], "results": []}
    cards = match_cards(mid, body.quantity or store.materials[mid]["qty_hint"],
                        body.location, body.price_quality)
    return {"material": store.materials[mid]["name"], "quantity": body.quantity,
            "location": body.location, "vendors": cards, "results": cards}


# ------------------------------------------------------------ /ai/chat ------
MATERIAL_IDS = ["cement", "steel", "sand", "aggregate", "bricks"]
MAT_KEYS = {
    "cement": r"cement|opc|ppc",
    "steel": r"steel|tmt|rebar|\brods?\b|reinforc|iron",
    "sand": r"\bsand\b|m-?sand|river sand|plaster",
    "aggregate": r"aggregate|gravel|jelly|blue ?metal|kapchi|\b20mm\b|\b40mm\b",
    "bricks": r"brick|block",
}
CTYPES = [
    (r"premium|luxury|high[- ]?end|rcc[- ]?heavy|villa", ("premium", 1.18)),
    (r"\beconomy\b|economical (build|construction|home)|low[- ]?cost (build|construction|home)|"
     r"basic (build|spec|construction)", ("economy", 0.9)),
]


def _construction_type(t: str):
    for rgx, val in CTYPES:
        if re.search(rgx, t):
            return val
    return ("standard", 1.0)


_WORDNUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
            "seven": 7, "eight": 8, "nine": 9, "ten": 10, "a": 1, "an": 1, "single": 1}
_AREA_UNIT = r"(?:sq\s?\.?\s?ft|sqft|sft|square\s*(?:feet|foot)?)"


def _to_int(s: str) -> int:
    s = (s or "").strip().lower()
    if s.isdigit():
        return int(s)
    return _WORDNUM.get(s, 1)


_COUNT_TOK = r"\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an|single"


def _parse_area(t: str) -> tuple[float, int]:
    """Sum built-up area from one message, honouring per-apartment breakdowns like
    'one 1150 sqft, one 1350 sqft, and other 2 flats of 2100 sqft each'. Returns
    (total_area, clause_count). Works clause by clause so a header count such as
    '4 apartments' never multiplies the wrong item. Plot units in sq yards/metres and
    the digits inside '3bhk' are ignored so they never masquerade as an area/count."""
    # drop the leading digit of bhk/rk tokens so '3bhk' is not read as a count
    t2 = re.sub(r"\b\d+\s*(bhks?|rks?)\b", r"\1", t)
    total, clauses = 0.0, 0
    for part in re.split(r"[,;.]|\band\b", t2):
        am = re.search(r"(\d[\d,]*)\s*" + _AREA_UNIT, part)
        if not am:
            continue
        area = float(am.group(1).replace(",", ""))
        if area < 80:                       # too small to be a built-up area
            continue
        before = part[:am.start()]
        # a count sitting immediately before the area wins ("one 1150 sqft" -> 1)
        adj = re.search(r"(" + _COUNT_TOK + r")\s*$", before.strip())
        if adj:
            cnt = _to_int(adj.group(1))
        elif re.search(r"\beach\b", part):  # "2 flats of 2100 sqft each" -> use the clause count
            nums = re.findall(r"\b(" + _COUNT_TOK + r")\b", before)
            cnt = _to_int(nums[-1]) if nums else 1
        else:
            cnt = 1
        total += max(1, cnt) * area
        clauses += 1
    return total, clauses


def parse_request(t: str, default_pq: int) -> dict:
    """Understand a whole request from one message (deterministic)."""
    req = {"materials": [], "qty": {}, "area": None, "floors": 1, "brick_walls": True,
           "wants_all": False, "greet": False, "nearby": False}
    req["construction_type"], req["mult"] = _construction_type(t)
    if re.search(r"cheap|budget|low price|economical|save money|tight", t):
        req["pq"] = 5
    elif re.search(r"quality|best|premium|top[- ]?rated|reliable|durable", t):
        req["pq"] = 90
    else:
        req["pq"] = default_pq
    req["materials"] = [k for k, rgx in MAT_KEYS.items() if re.search(rgx, t)]
    for mm in re.finditer(r"(\d[\d,\.]*)\s*(bags?|tonnes?|tons?|kg|t\b|pcs|pieces|nos)?\s*(of\s+)?"
                          r"(cement|steel|tmt|sand|aggregate|gravel|brick|block)?", t):
        near = mm.group(4)
        if near:
            key = ("steel" if near == "tmt" else "bricks" if near in ("brick", "block")
                   else "aggregate" if near == "gravel" else near)
            req["qty"][key] = float(mm.group(1).replace(",", ""))
    area_total, area_clauses = _parse_area(t)
    fm = re.search(r"(\d+)\s*-?\s*(?:floors?|stor(?:eys?|ys?|ies)|levels?|flr)", t)
    if fm:
        req["floors"] = max(1, int(fm.group(1)))
    gm = re.search(r"\bg\s*\+\s*(\d+)", t)
    if gm:
        req["floors"] = int(gm.group(1)) + 1
    if area_total:
        # When several apartments/units are itemised, that sum is the per-floor
        # area and the floor count multiplies it. A single area is taken as given.
        req["area"] = area_total
    if re.search(r"no bricks?|without bricks?|rcc only|no masonry", t):
        req["brick_walls"] = False
    if re.search(r"\beverything\b|\ball (the )?materials?\b|full (list|bom)|entire|"
                 r"whole (house|building|project|thing)|complete bom|one shot|single shot|"
                 r"everything i need|all i need|the works", t):
        req["wants_all"] = True
    # A bare "all" / "all of them" reply (e.g. after we asked which materials) means
    # "price every material" — list all five with typical quantities, don't re-ask.
    if re.fullmatch(r"\s*(yes,?\s*)?(all|everything|all of (it|them)|all materials?|price (them )?all|"
                    r"give me all|list all)\s*[!.]*\s*", t) and not req["area"]:
        req["wants_all"] = True
        if not req["materials"]:
            req["materials"] = list(MATERIAL_IDS)
    if re.search(r"\bnear(by| me| by)?\b|closest|nearest|around me|close to me", t):
        req["nearby"] = True
    if re.search(r"\b(hi|hello|hey|namaste|yo)\b", t) and not req["materials"] and not req["area"] \
            and not req["wants_all"]:
        req["greet"] = True
    return req


def llm_extract(message: str):
    """Optional real-LLM slot extractor. Enabled by AI_PROVIDER=openai|anthropic +
    AI_API_KEY. The LLM only extracts structure — every price/stock still comes
    from the pricing tools, so the marketplace stays trustworthy. Returns slots
    dict or None (falls back to the deterministic parser)."""
    provider = os.environ.get("AI_PROVIDER", "stub").lower()
    key = os.environ.get("AI_API_KEY", "")
    if provider not in ("openai", "anthropic") or not key:
        return None
    schema = (
        "You extract a construction-materials purchase request as STRICT JSON only. Keys: "
        "materials (array of {material: one of [cement,steel,sand,aggregate,bricks], quantity: number|null}), "
        "area (number|null = built-up sq ft per floor), floors (integer|null), "
        "construction_type (economy|standard|premium|null), brick_walls (boolean|null), "
        "location (one of [ibrahimpatnam,medchal,sangareddy,bhongir,ghatkesar,hyderabad]|null), "
        "intent (cheap|quality|balanced|null), wants_all (boolean). Output JSON only."
    )
    try:
        import httpx
        model = os.environ.get("AI_MODEL",
                               "gpt-4o-mini" if provider == "openai" else "claude-3-5-haiku-latest")
        if provider == "openai":
            r = httpx.post("https://api.openai.com/v1/chat/completions",
                           headers={"Authorization": f"Bearer {key}"},
                           json={"model": model, "temperature": 0,
                                 "response_format": {"type": "json_object"},
                                 "messages": [{"role": "system", "content": schema},
                                              {"role": "user", "content": message}]},
                           timeout=15)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
        else:
            r = httpx.post("https://api.anthropic.com/v1/messages",
                           headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                           json={"model": model, "max_tokens": 400, "system": schema,
                                 "messages": [{"role": "user", "content": message}]},
                           timeout=15)
            r.raise_for_status()
            content = r.json()["content"][0]["text"]
        return json.loads(content)
    except Exception:
        return None


def merge_llm(req: dict, slots) -> tuple[dict, Optional[str]]:
    if not slots:
        return req, None
    mats = list(req["materials"])
    for m in slots.get("materials") or []:
        mid = resolve_material(m.get("material", "") if isinstance(m, dict) else str(m))
        if mid:
            if mid not in mats:
                mats.append(mid)
            if isinstance(m, dict) and m.get("quantity"):
                req["qty"][mid] = float(m["quantity"])
    req["materials"] = mats
    if slots.get("area"):
        req["area"] = float(slots["area"])
    if slots.get("floors"):
        req["floors"] = int(slots["floors"])
    if slots.get("construction_type") in ("economy", "standard", "premium"):
        req["construction_type"] = slots["construction_type"]
        req["mult"] = {"economy": 0.9, "standard": 1.0, "premium": 1.18}[slots["construction_type"]]
    if slots.get("brick_walls") is not None:
        req["brick_walls"] = bool(slots["brick_walls"])
    if slots.get("wants_all"):
        req["wants_all"] = True
    if slots.get("intent") == "cheap":
        req["pq"] = 5
    elif slots.get("intent") == "quality":
        req["pq"] = 90
    return req, slots.get("location")


class ChatBody(BaseModel):
    message: str
    location: str = "hyderabad"
    price_quality: int = 35
    history: Optional[list] = None


def _inr(n) -> str:
    return "₹" + format(int(round(n)), ",")


def _build_lines(items: list, loc: str, pq: int):
    """items: [(material_id, quantity)] -> (suggestions, first-material cards, grand_total)."""
    sugg, cards, grand = [], [], 0.0
    for mid, q in items:
        rows = match_cards(mid, q, loc, pq)
        if not rows:
            continue
        if not cards:
            cards = rows
        best = rows[0]
        grand += best["landed_price"]
        sugg.append({"material": store.materials[mid]["name"], "quantity": q,
                     "unit": store.materials[mid]["unit"], "vendor": best["vendor"],
                     "landed_price": best["landed_price"]})
    return sugg, cards, grand


def _list_reply(sugg: list, loc: str, grand: float, lead: str, note: str = "") -> str:
    lines = "\n".join(f"• {s['material']}: {s['quantity']} {s['unit']} from {s['vendor']} "
                      f"({_inr(s['landed_price'])})" for s in sugg)
    return (f"{lead}.{note}\n{lines}\n\nThat comes to {_inr(grand)} delivered to {loc.title()}. "
            f"Want me to add all of it to your cart in one go?")


@router.post("/ai/chat")
def ai_chat(body: ChatBody):
    t = body.message.lower()
    loc = body.location or "hyderabad"
    for lid in store.locations:
        if lid in t:
            loc = lid
            break

    req = parse_request(t, body.price_quality)
    req, llm_loc = merge_llm(req, llm_extract(body.message))  # real LLM if configured, else no-op
    if llm_loc and llm_loc in store.locations:
        loc = llm_loc
    if loc == "ghatkesar":
        loc = "bhongir"
    pq = req["pq"]

    if req["greet"]:
        return {"reply": "Hi, I'm your Consmat procurement assistant. Tell me what you're building in "
                         "plain words and I'll work out the materials and price them delivered. For "
                         "example, try \"everything for a 1500 sqft 2 floor house in Medchal on a "
                         "budget\", or just name what you need like \"50 bags cement, 3 tonnes steel, "
                         "5000 bricks\".",
                "chips": ["Everything for a 1500 sqft house in Medchal",
                          "50 bags cement and 3 t steel in Medchal", "Just sand and aggregate, cheapest"],
                "cards": [], "suggestions": []}

    # ---- "Who's near me?" style questions with nothing else to go on ----
    if req["nearby"] and not req["materials"] and not req["area"] and not req["wants_all"]:
        near = store.dest(loc)
        return {"reply": f"For {loc.title()}, I line up the closest approved vendors for whatever you "
                         f"need and show the delivery distance on every quote. Tell me which materials "
                         f"you're after (or just say \"all\") and I'll price them from the nearest "
                         f"reliable seller.",
                "chips": ["All materials", "Cement", "TMT steel", "Sand", "Bricks"],
                "cards": [], "suggestions": []}

    # ---- Whole-project, single shot: area given -> full bill of materials ----
    if req["area"]:
        total_sqft, bom = domain.compute_bom(req["area"], req["floors"], req["mult"],
                                             req["brick_walls"], store.materials)
        items = [(l["material"], l["quantity"]) for l in bom]
        sugg, cards, grand = _build_lines(items, loc, pq)
        floor_txt = f"{req['floors']} floor{'s' if req['floors'] > 1 else ''}"
        lead = (f"Here's the full material list for a {int(total_sqft):,} sq ft {req['construction_type']} "
                f"build across {floor_txt}. I've picked the cheapest reliable vendor for each item, "
                f"with delivery included")
        return {"reply": _list_reply(sugg, loc, grand, lead),
                "chips": ["Add all to cart"],
                "cards": cards, "suggestions": sugg}

    # ---- "Everything" but no area yet -> one focused question ----
    if req["wants_all"] and not req["materials"]:
        return {"reply": "Happy to spec the whole thing in one go. What's the built-up area in sq ft and "
                         "how many floors? Something like \"1500 sqft, 2 floors, standard\" is all I "
                         "need, and I'll handle the rest.",
                "chips": ["1500 sqft, 2 floors", "2400 sqft, premium", "1000 sqft, economy"],
                "cards": [], "suggestions": []}

    mats = req["materials"] or (MATERIAL_IDS if req["wants_all"] else [])
    if not mats:
        return {"reply": "Sure, which materials do you need? I can do cement, TMT steel, sand, aggregate "
                         "and bricks. Name as many as you like in one message, or just say \"all\" and "
                         "I'll price the whole set together.",
                "chips": ["All materials", "Cement", "TMT steel", "Sand", "Bricks"],
                "cards": [], "suggestions": []}

    items = [(mid, req["qty"].get(mid) or store.materials[mid]["qty_hint"]) for mid in mats]
    sugg, cards, grand = _build_lines(items, loc, pq)
    missing = [store.materials[mid]["name"] for mid in mats if mid not in req["qty"]]
    note = (f" I've assumed typical quantities for {', '.join(missing)}, which you can adjust in the cart."
            if missing else "")

    if len(sugg) > 1:
        reply = _list_reply(sugg, loc, grand,
                            "Here's each item from the cheapest reliable vendor I could find", note)
    elif sugg:
        s = sugg[0]
        reply = (f"For {s['quantity']} {s['unit']} of {s['material']} delivered to {loc.title()}, your "
                 f"best value is {s['vendor']} at {_inr(s['landed_price'])}.{note} Want me to add it to "
                 f"your cart?")
    else:
        reply = ("I couldn't find an approved vendor that clears the quality bar for that just yet. "
                 "Try again with the quality bar a little lower and I'll widen the search.")
    return {"reply": reply,
            "chips": ["Add all to cart"],
            "cards": cards, "suggestions": sugg}


# ------------------------------------------------------------ /estimate -----
class EstimateBody(BaseModel):
    description: Optional[str] = ""
    area: Optional[float] = None
    location: str = "hyderabad"


@router.post("/estimate")
def estimate(body: EstimateBody):
    area = body.area or 0
    floors = 1
    mult = 1.0
    if body.description:
        fm = re.search(r"(\d+)\s*(floor|storey|story)", body.description.lower())
        if fm:
            floors = int(fm.group(1))
        if re.search(r"premium|luxury|rcc", body.description.lower()):
            mult = 1.18
        elif re.search(r"economy|budget|cheap", body.description.lower()):
            mult = 0.9
    if not area:
        area = 1000
    total_sqft, lines = domain.compute_bom(area, floors, mult, True, store.materials)
    items, grand = [], 0.0
    for l in lines:
        best = domain.cheapest(store.offers_for(l["material"]), l["quantity"], store.dest(body.location),
                               l["material"], store.pricing)
        price = round(best["landed_cost"], 2) if best else 0
        grand += price
        items.append({"material": l["name"], "quantity": l["quantity"], "unit": l["unit"], "price": price})
    return {"items": items, "total": round(grand, 2),
            "note": f"Rough estimate for {int(total_sqft):,} sq ft ({floors} floor(s)). Refine with an engineer."}


# ------------------------------------------------------------ /optimize -----
class OptItem(BaseModel):
    material: str
    quantity: float
    unit: Optional[str] = None
    vendor: Optional[str] = None


class OptimizeBody(BaseModel):
    items: list[OptItem]
    location: str = "hyderabad"


def _optimize(items: list[OptItem], location: str) -> dict:
    dest = store.dest(location)
    split, split_total = [], 0.0
    pairs = []
    for it in items:
        mid = resolve_material(it.material)
        if not mid:
            continue
        pairs.append((mid, it.quantity))
        best = domain.cheapest(store.offers_for(mid), it.quantity, dest, mid, store.pricing)
        if best:
            split_total += best["landed_cost"]
            split.append({"material": store.materials[mid]["name"], "vendor": best["vendor_name"],
                          "landed_price": round(best["landed_cost"], 2),
                          "quantity": it.quantity, "unit": store.materials[mid]["unit"]})
    # best single vendor covering the most
    best_single = None
    for v in store.vendors.values():
        if not v["approved"] or v["quality"] < store.pricing["quality_gate"]:
            continue
        total, covered, lines = 0.0, 0, []
        for mid, q in pairs:
            off = v["offers"].get(mid)
            if not off or off["stock"] <= 0:
                continue
            km = domain.distance_km(store.warehouses[v["warehouse"]], dest)
            landed = off["price"] * q + domain.logistics_cost(km, mid, store.pricing)
            total += landed
            covered += 1
            lines.append({"material": store.materials[mid]["name"], "vendor": v["name"],
                          "landed_price": round(landed, 2)})
        if covered == 0:
            continue
        eff = total + (len(pairs) - covered) * 9_000_000
        if best_single is None or eff < best_single["eff"]:
            best_single = {"name": v["name"], "total": round(total, 2), "covered": covered,
                           "items": lines, "eff": eff}
    savings = None
    recommended = "split"
    if best_single and best_single["covered"] == len(pairs):
        savings = round(best_single["total"] - split_total, 2)
        recommended = "split" if savings > 0 else "single"
    return {
        "savings": savings if savings and savings > 0 else 0,
        "recommended": recommended, "split": split, "split_total": round(split_total, 2),
        "single": {"total": best_single["total"] if best_single else 0,
                   "items": best_single["items"] if best_single else [],
                   "covered": best_single["covered"] if best_single else 0,
                   "vendor": best_single["name"] if best_single else None},
    }


@router.post("/optimize")
def optimize(body: OptimizeBody):
    return _optimize(body.items, body.location)


# ------------------------------------------------------------ checkout ------
class CheckoutItem(BaseModel):
    material: str
    quantity: float
    unit: Optional[str] = None
    vendor: Optional[str] = None
    price: Optional[float] = None


TRANSPORT_MODES = {"inbuilt", "external", "self"}


class CheckoutBody(BaseModel):
    items: list[CheckoutItem]
    payment_method: str = "upi"
    location: str = "hyderabad"
    transport: str = "inbuilt"          # inbuilt (Consmat fleet) | external (3rd-party) | self (pickup)
    optimize: Optional[Any] = None


@router.post("/orders/checkout")
def checkout(body: CheckoutBody, user: dict | None = Depends(optional_user)):
    dest = store.dest(body.location)
    transport = body.transport if body.transport in TRANSPORT_MODES else "inbuilt"
    order_items = []
    for it in body.items:
        mid = resolve_material(it.material)
        if not mid:
            continue
        best = domain.cheapest(store.offers_for(mid), it.quantity, dest, mid, store.pricing)
        if not best:
            continue
        item = store._mk_item(mid, it.quantity, best)
        if transport == "self":
            # Buyer arranges their own pickup, so the delivery leg drops off the price.
            item["landed_cost"] = round(item["unit_price"] * item["quantity"], 2)
        order_items.append(item)
    if not order_items:
        return {"order_id": None, "error": "No matchable items"}
    buyer_name = user["name"] if user else "Guest Buyer"
    buyer_id = user["email"] if user else None
    order = store.create_order(order_items, body.location, body.payment_method, buyer_id, buyer_name)
    order["transport"] = transport
    return {"order_id": order["id"], "transport": transport, "total": order["total"]}


@router.get("/orders")
def orders(user: dict | None = Depends(optional_user)):
    out = store.orders
    if user and user["role"] == "buyer":
        out = [o for o in store.orders if o.get("buyer_id") == user["email"]] or store.orders
    return {"orders": [buyer_order(o) for o in out]}


# ------------------------------------------------------------ tracking ------
_DRIVERS = [
    ("Ravi Kumar", "+91 98765 40001"), ("Suresh Reddy", "+91 98765 40002"),
    ("Imran Khan", "+91 98765 40003"), ("Mahesh Rao", "+91 98765 40004"),
    ("Venkatesh N", "+91 98765 40005"), ("Anil Yadav", "+91 98765 40006"),
]


def _driver_for(order: dict) -> dict:
    h = abs(hash(order["id"]))
    name, phone = _DRIVERS[h % len(_DRIVERS)]
    return {"name": name, "phone": phone,
            "vehicle_no": f"TS{10 + h % 30:02d} {'ABUVXY'[h % 6]}{'BCDGKL'[h % 6]} {1000 + h % 9000}"}


def _order_progress(o: dict) -> float:
    """0 at the origin, 1 at the buyer's site. Derived from the order timeline."""
    st = o["status"]
    if st == "delivered":
        return 1.0
    if st == "cancelled":
        return 0.0
    if st == "dispatched":
        disp, eta = o.get("dispatched_at"), o.get("eta_at")
        if disp and eta and eta > disp:
            frac = (_now() - disp).total_seconds() / (eta - disp).total_seconds()
            return max(0.05, min(0.97, frac))
        return 0.5
    return 0.0  # placed / preparing for dispatch


def build_tracking(o: dict) -> dict:
    primary = o["items"][0] if o["items"] else {}
    wh = store.warehouses.get(primary.get("warehouse_id")) or store.warehouses["hub"]
    dst = store.dest(o["location"])
    origin = {"lat": wh["lat"], "lng": wh["lng"], "name": wh["name"]}
    dest = {"lat": dst["lat"], "lng": dst["lng"], "name": dst.get("label", o["location"].title())}
    total_km = domain.distance_km(wh, dst)
    p = _order_progress(o)
    vehicle = {"lat": round(origin["lat"] + (dest["lat"] - origin["lat"]) * p, 5),
               "lng": round(origin["lng"] + (dest["lng"] - origin["lng"]) * p, 5)}
    stage = ("Delivered" if o["status"] == "delivered" else
             "Cancelled" if o["status"] == "cancelled" else
             "Out for delivery" if o["status"] == "dispatched" else
             "Preparing for dispatch")
    return {
        "order_id": o["id"], "status": o["status"], "stage": stage,
        "origin": origin, "dest": dest, "vehicle": vehicle,
        "progress": round(p, 3), "distance_km": total_km,
        "remaining_km": round(total_km * (1 - p)),
        "vendor": primary.get("vendor_name", ""),
        "transport": o.get("transport", "inbuilt"),
        "eta_at": iso(o.get("eta_at")),
        "dispatched_at": iso(o.get("dispatched_at")),
        "delivered_at": iso(o.get("delivered_at")),
        "driver": _driver_for(o) if o["status"] in ("dispatched", "delivered") else None,
    }


@router.get("/orders/{order_id}/tracking")
def order_tracking(order_id: str, user: dict | None = Depends(optional_user)):
    o = store.get_order(order_id)
    if not o:
        return {"error": "Order not found"}
    return build_tracking(o)


@router.get("/tracking/active")
def active_tracking(user: dict | None = Depends(optional_user)):
    """Every in-transit delivery, for a fleet / dispatch live view."""
    live = [build_tracking(o) for o in store.orders if o["status"] == "dispatched"]
    return {"count": len(live), "deliveries": live}
