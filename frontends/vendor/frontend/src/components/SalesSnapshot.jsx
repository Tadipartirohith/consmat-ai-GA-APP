import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, IndianRupee } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from "recharts";
import { formatINR, pick } from "@/lib/format";

const orderDate = (o) =>
  pick(o, ["created_at", "createdAt", "date", "placed_at", "timestamp"]);
const orderTotal = (o) =>
  Number(pick(o, ["total", "amount", "total_amount", "grand_total", "price"], 0)) || 0;

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-[#0f1216] px-2.5 py-1.5 text-xs">
      <p className="text-[#94a3b8]">{label}</p>
      <p className="font-semibold text-[#ff7a2f]">{formatINR(payload[0].value)}</p>
    </div>
  );
};

export const SalesSnapshot = ({ orders = [] }) => {
  const today = new Date().toISOString().slice(0, 10);
  const todays = orders.filter((o) => String(orderDate(o) || "").slice(0, 10) === today);

  const todayCount = todays.length;
  const todayRevenue = todays.reduce((sum, o) => sum + orderTotal(o), 0);
  const allRevenue = orders.reduce((sum, o) => sum + orderTotal(o), 0);

  const [range, setRange] = useState(7);

  const days = [...Array(range)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (range - 1 - i));
    return {
      key: d.toISOString().slice(0, 10),
      label: range <= 7 ? d.toLocaleDateString("en-IN", { weekday: "short" }) : `${d.getDate()}/${d.getMonth() + 1}`,
      revenue: 0,
    };
  });
  orders.forEach((o) => {
    const k = String(orderDate(o) || "").slice(0, 10);
    const day = days.find((x) => x.key === k);
    if (day) day.revenue += orderTotal(o);
  });
  const rangeTotal = days.reduce((s, d) => s + d.revenue, 0);
  const tickInterval = range <= 7 ? 0 : range <= 14 ? 1 : 4;

  const tiles = [
    { label: "Orders Today", value: todayCount, sub: `${orders.length} all-time`, icon: ShoppingBag, testid: "snapshot-orders-today" },
    { label: "Revenue Today", value: formatINR(todayRevenue), sub: `${formatINR(allRevenue)} all-time`, icon: IndianRupee, testid: "snapshot-revenue-today" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="space-y-4"
      data-testid="sales-snapshot"
    >
      <div className="grid grid-cols-2 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="rounded-lg border border-white/10 bg-[#171c22] p-4 sm:p-5" data-testid={t.testid}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">{t.label}</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#ff7a2f]/10 text-[#ff7a2f]">
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t.value}</p>
              <p className="mt-0.5 text-xs text-[#94a3b8]">{t.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/10 bg-[#171c22] p-4 sm:p-5" data-testid="revenue-sparkline">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">Last {range} Days Revenue</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-white/10 bg-[#0f1216] p-0.5" data-testid="revenue-range-toggle">
              {[7, 14, 30].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  data-testid={`revenue-range-${r}`}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors duration-200 ${
                    range === r ? "bg-[#ff7a2f] text-[#0f1216]" : "text-[#94a3b8] hover:text-white"
                  }`}
                >
                  {r}d
                </button>
              ))}
            </div>
            <p className="font-heading text-sm font-bold text-[#ff7a2f]" data-testid="revenue-range-total">{formatINR(rangeTotal)}</p>
          </div>
        </div>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff7a2f" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff7a2f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#ff7a2f", strokeOpacity: 0.3 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#ff7a2f"
                strokeWidth={2}
                fill="url(#revFill)"
                dot={range <= 14 ? { r: 2, fill: "#ff7a2f" } : false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};

export default SalesSnapshot;
