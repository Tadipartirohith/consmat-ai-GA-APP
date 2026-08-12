"""Pure pricing / ranking / estimator / optimizer math (no I/O). Ported from the
Consmat prototype and reused verbatim so numbers stay identical and auditable."""
from __future__ import annotations

import math


def distance_km(a: dict, b: dict) -> int:
    R = 6371.0
    d = math.pi / 180.0
    dlat = (b["lat"] - a["lat"]) * d
    dlng = (b["lng"] - a["lng"]) * d
    s = (math.sin(dlat / 2) ** 2
         + math.cos(a["lat"] * d) * math.cos(b["lat"] * d) * math.sin(dlng / 2) ** 2)
    return round(2 * R * math.asin(math.sqrt(s)) * 1.35)


def logistics_cost(km: int, material: str, cfg: dict) -> float:
    lf = cfg["load_factor"].get(material, 1.0)
    return km * cfg["rate_per_km"] * lf + cfg["handling"]


def value_score(landed: float, quality: float, pq: float) -> float:
    w = 0.03 + pq * 0.20
    target = 3.5 + pq * 1.3
    return landed * (1 + w * (target - quality))


def rank_vendors(offers: list[dict], quantity: float, dest: dict, pq_pct: float,
                 material: str, cfg: dict, include_oos: bool = False) -> list[dict]:
    """offers: [{vendor..., unit_price, stock, wh(dict)}]. Returns ranked rows.

    include_oos=True keeps out-of-stock vendors in the list (flagged and pushed to
    the bottom) so the shop can show them greyed. Pricing/AI paths leave it False so
    an out-of-stock vendor is never suggested or ordered."""
    pq = pq_pct / 100.0
    gate = cfg["quality_gate"]
    rows = []
    for o in offers:
        if not o.get("approved", True):
            continue
        oos = o["stock"] <= 0
        if oos and not include_oos:
            continue
        if o["quality"] < gate:
            continue
        km = distance_km(o["wh"], dest)
        logi = logistics_cost(km, material, cfg)
        mat = o["unit_price"] * quantity
        landed = mat + logi
        rows.append({
            **o, "distance_km": km, "logistics_cost": round(logi, 2),
            "material_cost": round(mat, 2), "landed_cost": round(landed, 2),
            "value_score": value_score(landed, o["quality"], pq),
            "in_stock": o["stock"] >= quantity, "out_of_stock": oos,
        })
    rows.sort(key=lambda r: (r["out_of_stock"], r["value_score"]))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows


def cheapest(offers: list[dict], quantity: float, dest: dict, material: str, cfg: dict):
    ranked = rank_vendors(offers, quantity, dest, 35, material, cfg)
    return min(ranked, key=lambda r: r["landed_cost"]) if ranked else None


def split_fill(offers: list[dict], quantity: float, dest: dict, material: str,
               cfg: dict) -> tuple[list[dict], float]:
    """Cheapest-first allocation of `quantity` across vendors, respecting each
    vendor's available stock. Returns (allocations, shortfall). Each allocation is
    {vendor_id, vendor_name, quantity, unit_price, logistics, landed_price, ...}.
    Logistics is a fixed per-delivery cost, so every vendor used adds its own."""
    rows = rank_vendors(offers, quantity, dest, 5, material, cfg)
    rows = sorted(rows, key=lambda r: (r["unit_price"], -r["quality"]))
    remaining = float(quantity)
    out: list[dict] = []
    for r in rows:
        if remaining <= 1e-9:
            break
        take = min(remaining, float(r["stock"]))
        if take <= 0:
            continue
        # keep tonne/pcs style rounding sane; cement is whole bags
        take = math.ceil(take) if material == "cement" else round(take, 2)
        take = min(take, float(r["stock"]))
        landed = r["unit_price"] * take + r["logistics_cost"]
        out.append({
            "vendor_id": r["vendor_id"], "vendor_name": r["vendor_name"],
            "quantity": take, "unit_price": r["unit_price"],
            "logistics": round(r["logistics_cost"], 2), "landed_price": round(landed, 2),
            "distance_km": r["distance_km"], "quality": r["quality"],
            "warehouse_name": r["warehouse_name"], "stock": r["stock"],
        })
        remaining -= take
    return out, max(0.0, round(remaining, 2))


def compute_bom(area_per_floor: float, floors: int, multiplier: float,
                brick_walls: bool, materials: dict) -> tuple[float, list[dict]]:
    total = area_per_floor * floors
    lines = []
    for mid, m in materials.items():
        if mid == "bricks" and not brick_walls:
            continue
        q = total * m["per_sqft"] * multiplier
        q = math.ceil(q) if mid == "cement" else max(1.0, round(q * 10) / 10)
        lines.append({"material": mid, "name": m["name"], "grade": m["grade"],
                      "unit": m["unit"], "quantity": q})
    return total, lines
