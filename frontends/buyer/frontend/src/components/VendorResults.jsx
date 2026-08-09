import React, { useMemo, useState, useEffect } from "react";
import { VendorCard } from "@/components/VendorCard";
import { Slider } from "@/components/ui/slider";
import { formatINR, titleCase } from "@/lib/format";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

// Sort options requested by buyers: price both ways, rating, distance, product quality.
const SORTS = [
  { id: "price_asc", label: "Lowest price" },
  { id: "price_desc", label: "Highest price" },
  { id: "rating", label: "Rating" },
  { id: "distance", label: "Distance" },
  { id: "quality", label: "Product quality" },
];

const num = (v, d = 0) => (v === undefined || v === null || isNaN(Number(v)) ? d : Number(v));
const priceOf = (c) => num(c.landed_price ?? c.price ?? c.total_price, 0);
const ratingOf = (c) => num(c.quality ?? c.rating, 0);
const distOf = (c) => num(c.distance ?? c.distance_km, 0);
const isiOf = (c) => (c.isi ? 1 : 0);

const sorters = {
  price_asc: (a, b) => priceOf(a) - priceOf(b),
  price_desc: (a, b) => priceOf(b) - priceOf(a),
  rating: (a, b) => ratingOf(b) - ratingOf(a),
  distance: (a, b) => distOf(a) - distOf(b),
  // Product quality favours ISI-certified stock first, then the higher star rating.
  quality: (a, b) => isiOf(b) - isiOf(a) || ratingOf(b) - ratingOf(a),
};

export function VendorResults({ cards = [], onAdd }) {
  const [sort, setSort] = useState("price_asc");

  const [lo, hi] = useMemo(() => {
    if (!cards.length) return [0, 0];
    const prices = cards.map(priceOf);
    return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
  }, [cards]);

  const [range, setRange] = useState([lo, hi]);
  // Reset the price window whenever a fresh result set arrives.
  useEffect(() => setRange([lo, hi]), [lo, hi]);

  const span = hi - lo;
  const step = Math.max(1, Math.round(span / 100));

  const view = useMemo(() => {
    const [min, max] = range;
    return cards
      .filter((c) => {
        const p = priceOf(c);
        return p >= min - 0.5 && p <= max + 0.5;
      })
      .sort(sorters[sort] || sorters.price_asc);
  }, [cards, range, sort]);

  const handleAdd = onAdd
    ? (item) => {
        onAdd(item);
        toast.success(`Added ${titleCase(item.material || "item")} to cart`, {
          description: item.vendor ? `from ${item.vendor}` : undefined,
        });
      }
    : undefined;

  if (!cards.length) return null;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-[#171c22] p-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-[#ff7a2f]" />
          <label className="text-[10px] uppercase tracking-[0.2em] text-white/40">Sort by</label>
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

        {span > 0 && (
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
              <span>Price range</span>
              <span className="font-mono text-[11px] text-[#ff7a2f]">
                {formatINR(range[0])} – {formatINR(range[1])}
              </span>
            </div>
            <Slider
              data-testid="price-range-slider"
              min={lo}
              max={hi}
              step={step}
              value={range}
              onValueChange={setRange}
              className="py-1"
            />
          </div>
        )}
      </div>

      <p className="mb-3 text-xs text-white/40" data-testid="results-count">
        Showing {view.length} of {cards.length} vendors
      </p>

      {view.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-[#171c22] py-12 text-center text-sm text-white/50">
          No vendors in this price range. Widen the slider to see more.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {view.map((r, i) => (
            <VendorCard key={r.vendor_id || i} data={r} index={i} onAdd={handleAdd} />
          ))}
        </div>
      )}
    </div>
  );
}
