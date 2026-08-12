import React, { useMemo, useState, useEffect } from "react";
import { VendorCard } from "@/components/VendorCard";
import { formatINR, titleCase } from "@/lib/format";
import { SlidersHorizontal, Wand2, ShoppingCart, RotateCcw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const SORTS = [
  { id: "price_asc", label: "Lowest price" },
  { id: "price_desc", label: "Highest price" },
  { id: "rating", label: "Rating" },
  { id: "distance", label: "Distance" },
  { id: "quality", label: "Product quality" },
];

const num = (v, d = 0) => (v === undefined || v === null || isNaN(Number(v)) ? d : Number(v));
const unitOf = (c) => num(c.price_per_unit ?? c.unit_price ?? c.rate, 0);
const ratingOf = (c) => num(c.quality ?? c.rating, 0);
const distOf = (c) => num(c.distance ?? c.distance_km, 0);
const isiOf = (c) => (c.isi ? 1 : 0);
const vidOf = (c) => c.vendor_id || c.vendor || c.vendor_name;

const sorters = {
  price_asc: (a, b) => unitOf(a) - unitOf(b),
  price_desc: (a, b) => unitOf(b) - unitOf(a),
  rating: (a, b) => ratingOf(b) - ratingOf(a),
  distance: (a, b) => distOf(a) - distOf(b),
  quality: (a, b) => isiOf(b) - isiOf(a) || ratingOf(b) - ratingOf(a),
};

// `target` + `unit` turn this into an allocation view where the buyer decides how
// much to buy from each vendor (splitting an order across vendors). Without a
// target it stays a simple sorted list with per-card add-to-cart.
export function VendorResults({ cards = [], onAdd, target = 0, unit = "units" }) {
  const [sort, setSort] = useState("price_asc");
  const [alloc, setAlloc] = useState({});

  // Reset allocations whenever a fresh result set arrives.
  useEffect(() => setAlloc({}), [cards, target]);

  const view = useMemo(() => [...cards].sort(sorters[sort] || sorters.price_asc), [cards, sort]);

  const material = cards[0]?.material || "";
  const allocMode = target > 0;

  const allocated = Object.values(alloc).reduce((a, q) => a + (Number(q) || 0), 0);
  const remaining = Math.max(0, target - allocated);
  const allocTotal = view.reduce((sum, c) => {
    const q = Number(alloc[vidOf(c)]) || 0;
    return sum + (q > 0 ? unitOf(c) * q + num(c.logistics_cost ?? c.logistics) : 0);
  }, 0);

  const setOne = (id, q) => setAlloc((prev) => ({ ...prev, [id]: q }));

  // Fill cheapest-first, respecting each vendor's stock, up to the target.
  const autoSplit = () => {
    let left = target;
    const next = {};
    [...cards].sort((a, b) => unitOf(a) - unitOf(b)).forEach((c) => {
      if (left <= 0) return;
      const cap = c.stock != null ? c.stock : left;
      const take = Math.min(left, cap);
      if (take > 0) {
        next[vidOf(c)] = material === "Cement" ? Math.ceil(take) : Math.round(take * 100) / 100;
        left -= take;
      }
    });
    setAlloc(next);
    if (left > 0) toast.warning(`Only enough stock for ${target - left} of ${target} ${unit}.`);
  };

  const addAllocations = () => {
    const lines = view
      .map((c) => ({ c, q: Number(alloc[vidOf(c)]) || 0 }))
      .filter((x) => x.q > 0);
    if (!lines.length) {
      toast.error("Enter how much to buy from at least one vendor.");
      return;
    }
    lines.forEach(({ c, q }) =>
      onAdd?.({
        material: c.material || material,
        quantity: q,
        unit,
        vendor: c.vendor || c.vendor_name,
        vendor_id: c.vendor_id,
        unit_price: unitOf(c),
        logistics: num(c.logistics_cost ?? c.logistics),
        price: unitOf(c) * q + num(c.logistics_cost ?? c.logistics),
      })
    );
    toast.success(`Added ${lines.length} vendor line(s) for ${titleCase(material)} to cart`, {
      description: `${allocated} ${unit} total`,
    });
    setAlloc({});
  };

  if (!cards.length) return null;

  return (
    <div>
      {/* Sort bar */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-[#171c22] p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-[#ff7a2f]" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Sort by</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.id}
              data-testid={`sort-${s.id}`}
              onClick={() => setSort(s.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                sort === s.id
                  ? "bg-[#ff7a2f] text-black"
                  : "border border-white/10 bg-[#0f1216] text-white/60 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allocation tracker */}
      {allocMode && (
        <div
          data-testid="alloc-tracker"
          className="mb-4 rounded-xl border border-white/10 bg-[#171c22] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm">
                <span className="text-white/50">You need </span>
                <span className="font-semibold">{target} {unit}</span>
                <span className="text-white/50"> of {titleCase(material)}. Split it across vendors.</span>
              </p>
              <p className="mt-1 text-xs">
                <span
                  data-testid="alloc-count"
                  className={`font-semibold ${remaining === 0 ? "text-[#22c55e]" : "text-[#ff7a2f]"}`}
                >
                  {allocated} / {target} {unit} allocated
                </span>
                {remaining > 0 && <span className="text-white/40"> · {remaining} {unit} to go</span>}
                {allocTotal > 0 && (
                  <span className="text-white/40"> · {formatINR(allocTotal)} total</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                data-testid="auto-split-btn"
                onClick={autoSplit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff7a2f]/40 bg-[#ff7a2f]/10 px-3 py-1.5 text-xs font-semibold text-[#ff7a2f] transition-colors hover:bg-[#ff7a2f]/20"
              >
                <Wand2 size={14} /> Auto-split (cheapest)
              </button>
              {allocated > 0 && (
                <button
                  data-testid="alloc-clear-btn"
                  onClick={() => setAlloc({})}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/50 transition-colors hover:text-white"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
          </div>
          {allocated > target && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-[#f59e0b]">
              <AlertTriangle size={12} /> You've allocated more than you need ({allocated} vs {target} {unit}).
            </p>
          )}
        </div>
      )}

      <p className="mb-3 text-xs text-white/40" data-testid="results-count">
        {view.length} vendor{view.length === 1 ? "" : "s"} supplying {titleCase(material) || "this material"}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {view.map((c, i) => (
          <VendorCard
            key={vidOf(c) || i}
            data={c}
            index={i}
            allocMode={allocMode}
            allocation={Number(alloc[vidOf(c)]) || 0}
            onAllocChange={(q) => setOne(vidOf(c), q)}
            target={target}
            onAdd={allocMode ? undefined : onAdd}
          />
        ))}
      </div>

      {allocMode && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f1216]/95 p-3 backdrop-blur">
          <span className="text-sm text-white/60">
            {allocated > 0 ? (
              <>
                <span className="font-semibold text-white">{allocated} {unit}</span> ·{" "}
                <span className="font-mono text-[#ff7a2f]">{formatINR(allocTotal)}</span>
              </>
            ) : (
              "Allocate quantities above, or tap Auto-split"
            )}
          </span>
          <button
            data-testid="add-allocations-btn"
            onClick={addAllocations}
            disabled={allocated <= 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff7a2f] px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-[#e66822] disabled:opacity-50"
          >
            {remaining === 0 ? <CheckCircle2 size={16} /> : <ShoppingCart size={16} />}
            Add to cart
          </button>
        </div>
      )}
    </div>
  );
}
