import React, { useEffect, useState } from "react";
import { getMaterials, match } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { VendorResults } from "@/components/VendorResults";
import { titleCase } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Package, AlertCircle, ArrowLeft, Ruler } from "lucide-react";
import { toast } from "sonner";

export function ShopMode() {
  const { location, priceQuality, addToCart } = useApp();
  const [materials, setMaterials] = useState([]);
  const [loadingMats, setLoadingMats] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(""); // optional planning quantity (target)
  const [results, setResults] = useState(null);
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingMats(true);
    getMaterials()
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : data?.materials || data?.items || [];
        setMaterials(list);
        setError(null);
      })
      .catch((e) => alive && setError(e?.message || "Failed to load materials"))
      .finally(() => alive && setLoadingMats(false));
    return () => {
      alive = false;
    };
  }, []);

  const qtyNum = Number(quantity);
  const unit = selected?.unit || selected?.uom || "units";
  const matName = selected?.name || selected?.material || selected?.title;

  // Load every vendor for the picked material right away (like browsing a product's
  // sellers). Per-unit price + stock don't depend on quantity, so no re-fetch when
  // the buyer changes how much they need.
  useEffect(() => {
    if (!selected) {
      setResults(null);
      return;
    }
    let alive = true;
    setMatching(true);
    match({ material: matName, quantity: 1, location, price_quality: priceQuality })
      .then((data) => {
        if (!alive) return;
        const cards = Array.isArray(data) ? data : data?.vendors || data?.matches || data?.results || [];
        setResults(cards);
      })
      .catch(() => {
        if (alive) {
          toast.error("Couldn't load vendors. Backend not reachable.");
          setResults([]);
        }
      })
      .finally(() => alive && setMatching(false));
    return () => {
      alive = false;
    };
  }, [selected, location, priceQuality, matName]);

  const openMaterial = (mat) => {
    setSelected(mat);
    setQuantity("");
    setResults(null);
  };

  const back = () => {
    setSelected(null);
    setQuantity("");
    setResults(null);
  };

  const filtered = materials.filter((m) => {
    const name = (m?.name || m?.material || m?.title || "").toLowerCase();
    return name.includes(query.toLowerCase());
  });

  if (selected) {
    return (
      <div>
        <button
          data-testid="shop-back-btn"
          onClick={back}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-[#ff7a2f]"
        >
          <ArrowLeft size={16} /> Back to materials
        </button>

        <div className="mb-4">
          <h2 className="font-head text-2xl font-bold tracking-tight">{titleCase(matName || "Matches")}</h2>
          <p className="text-sm text-white/50">
            Vendors supplying {titleCase(matName || "this material")}, delivered to {titleCase(location)}. Pick
            how much to buy from each.
          </p>
        </div>

        {/* Optional planning quantity — drives the tracker + auto-split */}
        <div className="mb-5 max-w-xs">
          <label className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
            <Ruler size={12} /> How much do you need? (optional)
          </label>
          <div className="flex items-center gap-2">
            <Input
              data-testid="shop-quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`e.g. 100 ${unit}`}
              className="border-white/10 bg-[#171c22]"
            />
            <span className="shrink-0 text-sm text-white/40">{unit}</span>
          </div>
        </div>

        {matching ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl bg-[#171c22]" />
            ))}
          </div>
        ) : results && results.length > 0 ? (
          <VendorResults cards={results} onAdd={addToCart} target={qtyNum > 0 ? qtyNum : 0} unit={unit} />
        ) : (
          <EmptyState text="No vendors carry this material yet." />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-head text-2xl font-bold tracking-tight">Shop materials</h2>
          <p className="text-sm text-white/50">Pick a material to see every vendor and their prices.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <Input
            data-testid="material-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search materials..."
            className="border-white/10 bg-[#171c22] pl-9"
          />
        </div>
      </div>

      {error ? (
        <EmptyState text={error} icon={AlertCircle} />
      ) : loadingMats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-[#171c22]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState text="No materials found." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((m, i) => {
            const img = m?.image || m?.image_url || m?.imageUrl || m?.thumbnail || m?.photo;
            return (
              <button
                key={m?.id || i}
                data-testid={`material-card-${i}`}
                onClick={() => openMaterial(m)}
                className="group flex items-center gap-4 rounded-xl border border-white/10 bg-[#171c22] p-4 text-left transition-transform duration-200 hover:-translate-y-1 hover:border-[#ff7a2f]/50 animate-fade-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {img ? (
                  <img
                    src={img}
                    alt={m?.name || "material"}
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/30 text-[#ff7a2f]">
                    <Package size={22} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">
                    {titleCase(m?.name || m?.material || m?.title || "Material")}
                  </p>
                  <p className="truncate text-xs text-white/50">
                    {m?.category ? titleCase(m.category) + " · " : ""}
                    {m?.unit || "per unit"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, icon: Icon = Package }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#171c22] py-16 text-center">
      <Icon size={32} className="mb-3 text-white/30" />
      <p className="max-w-sm text-sm text-white/50">{text}</p>
    </div>
  );
}
