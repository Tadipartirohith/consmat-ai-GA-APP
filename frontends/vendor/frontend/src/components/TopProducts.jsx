import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Package } from "lucide-react";
import { formatINR, pick, getOfferName, getOfferImage } from "@/lib/format";

const itemName = (it) =>
  pick(it, ["name", "title", "product_name", "product", "item_name", "offer_name"], "Item");
const itemQty = (it) => Number(pick(it, ["quantity", "qty", "count", "units"], 1)) || 0;
const itemPrice = (it) => Number(pick(it, ["price", "unit_price", "amount", "cost"], 0)) || 0;

const Thumb = ({ src, size = 30 }) => {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-md border border-white/10 bg-[#0f1216] text-[#94a3b8]"
        style={{ width: size, height: size }}
      >
        <Package size={14} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setErr(true)}
      className="shrink-0 rounded-md border border-white/10 object-cover"
      style={{ width: size, height: size }}
    />
  );
};

export const TopProducts = ({ orders = [], offers = [] }) => {
  const imageByName = new Map();
  offers.forEach((o) => imageByName.set(getOfferName(o), getOfferImage(o)));

  const map = new Map();
  orders.forEach((o) => {
    const items = pick(o, ["items", "line_items", "offers", "products"], []);
    if (!Array.isArray(items)) return;
    items.forEach((it) => {
      const name = itemName(it);
      const qty = itemQty(it);
      const rev = qty * itemPrice(it);
      const cur = map.get(name) || { name, qty: 0, revenue: 0 };
      cur.qty += qty;
      cur.revenue += rev;
      map.set(name, cur);
    });
  });

  const top = [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  if (top.length === 0) return null;
  const max = top[0].qty || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="rounded-lg border border-white/10 bg-[#171c22] p-4 sm:p-5"
      data-testid="top-products"
    >
      <div className="mb-4 flex items-center gap-2">
        <Trophy size={16} className="text-[#ff7a2f]" />
        <h2 className="font-heading text-lg font-bold tracking-tight">Top Products</h2>
      </div>
      <div className="space-y-3">
        {top.map((p, i) => (
          <div key={p.name} className="flex items-center gap-3" data-testid={`top-product-${i}`}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#ff7a2f]/10 text-xs font-bold text-[#ff7a2f]">
              {i + 1}
            </span>
            <Thumb src={imageByName.get(p.name)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-white">{p.name}</span>
                <span className="shrink-0 text-xs text-[#94a3b8]">
                  {p.qty} sold · {formatINR(p.revenue)}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-[#ff7a2f] transition-[width] duration-500"
                  style={{ width: `${(p.qty / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default TopProducts;
