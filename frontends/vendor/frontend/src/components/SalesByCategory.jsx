import { useState } from "react";
import { motion } from "framer-motion";
import { PieChart } from "lucide-react";
import { PieChart as RPieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { formatINR, pick, getOfferName, getOfferCategory } from "@/lib/format";

const itemName = (it) =>
  pick(it, ["name", "title", "product_name", "product", "item_name", "offer_name"], "Item");
const itemQty = (it) => Number(pick(it, ["quantity", "qty", "count", "units"], 1)) || 0;
const itemPrice = (it) => Number(pick(it, ["price", "unit_price", "amount", "cost"], 0)) || 0;
const itemCategory = (it) => pick(it, ["category", "type", "group"], "");

const PALETTE = ["#ff7a2f", "#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#f472b6"];

export const SalesByCategory = ({ orders = [], offers = [] }) => {
  const [active, setActive] = useState(null);
  const categoryByName = new Map();
  offers.forEach((o) => categoryByName.set(getOfferName(o), getOfferCategory(o)));

  const map = new Map();
  orders.forEach((o) => {
    const items = pick(o, ["items", "line_items", "offers", "products"], []);
    if (!Array.isArray(items)) return;
    items.forEach((it) => {
      const cat =
        itemCategory(it) || categoryByName.get(itemName(it)) || "Uncategorized";
      const rev = itemQty(it) * itemPrice(it);
      map.set(cat, (map.get(cat) || 0) + rev);
    });
  });

  const rows = [...map.entries()]
    .map(([category, revenue]) => ({ category, revenue }))
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const total = rows.reduce((s, r) => s + r.revenue, 0);
  if (rows.length === 0 || total === 0) return null;

  const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    );
  };

  const toggle = (i) => setActive((a) => (a === i ? null : i));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-lg border border-white/10 bg-[#171c22] p-4 sm:p-5"
      data-testid="sales-by-category"
    >
      <div className="mb-4 flex items-center gap-2">
        <PieChart size={16} className="text-[#ff7a2f]" />
        <h2 className="font-heading text-lg font-bold tracking-tight">Sales by Category</h2>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative h-40 w-40 shrink-0" data-testid="category-donut">
          <ResponsiveContainer width="100%" height="100%">
            <RPieChart>
              <Pie
                data={rows}
                dataKey="revenue"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={68}
                paddingAngle={2}
                stroke="none"
                activeIndex={active ?? undefined}
                activeShape={renderActiveShape}
                onClick={(_, i) => toggle(i)}
              >
                {rows.map((r, i) => (
                  <Cell
                    key={r.category}
                    fill={PALETTE[i % PALETTE.length]}
                    opacity={active === null || active === i ? 1 : 0.35}
                    className="cursor-pointer outline-none transition-opacity duration-200"
                  />
                ))}
              </Pie>
            </RPieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            {active != null ? (
              <>
                <span className="max-w-[88px] truncate text-[10px] uppercase tracking-wide text-[#94a3b8]">
                  {rows[active].category}
                </span>
                <span className="text-sm font-bold text-white">
                  {Math.round((rows[active].revenue / total) * 100)}%
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase tracking-wide text-[#94a3b8]">Total</span>
                <span className="text-sm font-bold text-[#ff7a2f]">{formatINR(total)}</span>
              </>
            )}
          </div>
        </div>

        <div className="w-full flex-1 space-y-1">
          {rows.map((r, i) => (
            <button
              key={r.category}
              onClick={() => toggle(i)}
              data-testid={`category-row-${r.category}`}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-200 hover:bg-white/5 ${
                active === i ? "bg-white/5" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <span className="truncate text-white">{r.category}</span>
              </div>
              <span className="shrink-0 text-[#94a3b8]">
                {formatINR(r.revenue)} · {Math.round((r.revenue / total) * 100)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default SalesByCategory;
