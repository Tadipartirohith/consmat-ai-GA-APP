import React from "react";
import { MapPin, Route, Package, Truck, Info, Plus, AlertTriangle } from "lucide-react";
import { StarRating } from "@/components/StarRating";
import { formatINR, titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Defensive accessor for varied API field names.
const pick = (obj, keys, fallback = undefined) => {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  }
  return fallback;
};

export function VendorCard({
  data,
  onAdd,
  index = 0,
  allocMode = false,
  allocation = 0,
  onAllocChange,
  target = 0,
}) {
  const vendor = pick(data, ["vendor", "vendor_name", "name", "supplier"], "Vendor");
  const material = pick(data, ["material", "material_name", "product"], "");
  const quantity = pick(data, ["quantity", "qty"]);
  const unit = pick(data, ["unit", "uom"], "");
  const landed = pick(data, ["landed_price", "landedPrice", "total_price", "price"]);
  const materialCost = pick(data, ["material_cost", "materialCost", "base_price", "material_price"]);
  const logisticsCost = pick(data, ["logistics_cost", "logisticsCost", "logistics", "delivery_cost"]);
  const quality = pick(data, ["quality", "quality_rating", "rating", "stars", "quality_stars"], 0);
  const warehouse = pick(data, ["warehouse", "warehouse_name", "origin", "source"], "");
  const distance = pick(data, ["distance", "distance_km", "distanceKm", "km"]);
  const why = pick(data, ["why", "reason", "explanation", "rationale"], "");
  const perUnit = pick(data, ["price_per_unit", "unit_price", "rate"]);
  const stock = pick(data, ["stock", "available", "in_stock_qty"]);

  // Surface stock only when it matters: running low, or can't cover the order.
  const cannotCover = stock != null && target > 0 && stock < target;
  const showStock = stock != null && (stock <= 50 || cannotCover);
  const maxAlloc = stock != null ? stock : target || undefined;
  const lineTotal = allocation > 0 ? (Number(perUnit) || 0) * allocation + (Number(logisticsCost) || 0) : 0;

  return (
    <div
      data-testid="vendor-card"
      className="group relative flex flex-col rounded-xl border border-white/10 bg-[#171c22] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-transform duration-200 hover:-translate-y-1 hover:border-[#ff7a2f]/50 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-head text-lg font-bold leading-tight truncate" data-testid="vendor-name">
            {vendor}
          </h4>
          {material ? (
            <p className="mt-0.5 text-sm text-white/60 truncate">
              {titleCase(material)}
              {!allocMode && quantity ? ` · ${quantity} ${unit}` : ""}
            </p>
          ) : null}
        </div>
        <StarRating value={quality} />
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {allocMode ? "Price" : "Landed price"}
          </p>
          {allocMode ? (
            <p className="font-mono text-2xl font-bold text-[#ff7a2f]">
              {formatINR(perUnit)}
              <span className="text-sm font-normal text-white/50"> / {unit || "unit"}</span>
            </p>
          ) : (
            <>
              <p className="font-mono text-2xl font-bold text-[#ff7a2f]" data-testid="landed-price">
                {formatINR(landed)}
              </p>
              {perUnit ? (
                <p className="text-xs text-white/50">
                  {formatINR(perUnit)} / {unit || "unit"}
                </p>
              ) : null}
            </>
          )}
        </div>
        {showStock && (
          <span
            data-testid="vendor-stock"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
              cannotCover ? "bg-[#f59e0b]/15 text-[#f59e0b]" : "bg-white/5 text-white/60"
            }`}
          >
            {cannotCover && <AlertTriangle size={12} />}
            {cannotCover ? `Only ${stock} ${unit} left` : `${stock} ${unit} in stock`}
          </span>
        )}
      </div>

      {!allocMode && (materialCost !== undefined || logisticsCost !== undefined) && (
        <div className="mt-4 space-y-1.5 rounded-lg bg-black/25 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-white/60">
              <Package size={14} className="text-white/40" /> Material
            </span>
            <span className="font-mono">{formatINR(materialCost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-white/60">
              <Truck size={14} className="text-white/40" /> Logistics
            </span>
            <span className="font-mono">{formatINR(logisticsCost)}</span>
          </div>
        </div>
      )}

      {(warehouse || distance !== undefined) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/60">
          {warehouse ? (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} className="text-[#ff7a2f]" /> {titleCase(warehouse)}
            </span>
          ) : null}
          {distance !== undefined ? (
            <span className="flex items-center gap-1.5">
              <Route size={13} className="text-white/40" /> {distance} km
            </span>
          ) : null}
        </div>
      )}

      {!allocMode && why ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#ff7a2f]/20 bg-[#ff7a2f]/5 p-2.5 text-xs text-white/70">
          <Info size={14} className="mt-0.5 shrink-0 text-[#ff7a2f]" />
          <span>{why}</span>
        </div>
      ) : null}

      {allocMode ? (
        <div className="mt-4 border-t border-white/10 pt-3">
          <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-white/40">
            Buy from this vendor ({unit})
          </label>
          <div className="flex items-center gap-2">
            <Input
              data-testid="vendor-alloc-input"
              type="number"
              min="0"
              max={maxAlloc}
              value={allocation || ""}
              onChange={(e) => {
                let v = Math.max(0, Number(e.target.value) || 0);
                if (stock != null) v = Math.min(v, stock);
                onAllocChange?.(v);
              }}
              placeholder="0"
              className="h-9 border-white/10 bg-[#0f1216] text-center"
            />
            <span className="w-10 shrink-0 text-xs text-white/40">{unit}</span>
          </div>
          {allocation > 0 && (
            <p className="mt-2 text-right text-sm">
              <span className="text-white/50">Subtotal </span>
              <span className="font-mono font-bold text-[#ff7a2f]">{formatINR(lineTotal)}</span>
              <span className="text-[11px] text-white/40"> incl. delivery</span>
            </p>
          )}
        </div>
      ) : (
        onAdd && (
          <Button
            data-testid="vendor-add-to-cart"
            onClick={() =>
              onAdd({
                material: material || vendor,
                quantity: quantity || 1,
                unit,
                vendor,
                price: landed,
                unit_price: perUnit,
                logistics: logisticsCost,
              })
            }
            className="mt-4 w-full rounded-lg bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
          >
            <Plus size={16} className="mr-1" /> Add to cart
          </Button>
        )
      )}
    </div>
  );
}
