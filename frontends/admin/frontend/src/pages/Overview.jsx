import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { IndianRupee, ShoppingCart, Store, ShieldCheck, TrendingUp, ArrowUpRight, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, compactINR, formatINR } from "@/lib/api";
import { StarRating } from "@/components/StarRating";

const STATUS_STYLES = {
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  in_transit: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  processing: "bg-cm-accent/10 text-cm-accent border-cm-accent/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || "bg-cm-panel2 text-cm-muted border-cm-border";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-500 capitalize ${cls}`}>
      {String(status).replace("_", " ")}
    </span>
  );
}

const TILES = [
  { key: "gmv", label: "Gross Merchandise Value", icon: IndianRupee, fmt: (v) => compactINR(v), accent: true, hint: "Non-cancelled orders" },
  { key: "orders", label: "Total Orders", icon: ShoppingCart, fmt: (v) => (v ?? 0).toLocaleString("en-IN"), hint: "In selected period" },
  { key: "active_vendors", label: "Active Vendors", icon: Store, fmt: (v) => v ?? 0, hint: "KYC approved" },
  { key: "pending_kyc", label: "Pending KYC", icon: ShieldCheck, fmt: (v) => v ?? 0, hint: "Awaiting approval", warn: true },
];

const PERIODS = [
  { key: "all", label: "All time" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
];

function periodStart(key) {
  const now = new Date();
  if (key === "7d") { const d = new Date(now); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); }
  if (key === "30d") { const d = new Date(now); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); }
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return null;
}

export default function Overview() {
  const [period, setPeriod] = useState("all");
  const start = periodStart(period);
  const metricsQ = useQuery({
    queryKey: ["metrics", period],
    queryFn: async () => (await api.get("/admin/metrics", { params: start ? { start } : {} })).data,
  });
  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: async () => (await api.get("/admin/orders")).data });
  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: async () => (await api.get("/admin/vendors")).data });

  const m = metricsQ.data || {};
  const recentOrders = (ordersQ.data || []).slice(0, 5);
  const pendingVendors = (vendorsQ.data || []).filter((v) => v.kyc_status === "pending").slice(0, 4);

  const series = (() => {
    const byDay = {};
    (ordersQ.data || []).forEach((o) => {
      if (o.status === "cancelled") return;
      const day = (o.created_at || "").slice(0, 10);
      if (!day) return;
      if (start && day < start) return;
      byDay[day] = (byDay[day] || 0) + o.amount;
    });
    return Object.keys(byDay)
      .sort()
      .map((day) => ({
        day,
        label: new Date(day + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        gmv: byDay[day],
      }));
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-cm-muted">GMV & orders for period</span>
        <div className="flex gap-1 rounded-md border border-cm-border bg-cm-panel p-1" data-testid="period-selector">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              data-testid={`period-${p.key}`}
              className={`rounded px-3 py-1.5 text-xs font-500 transition-colors ${
                period === p.key ? "bg-cm-accent text-black" : "text-cm-muted hover:text-cm-text"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="metrics-grid">
        {TILES.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.div
              key={t.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              data-testid={`metric-tile-${t.key}`}
              className="relative overflow-hidden rounded-lg border border-cm-border bg-cm-panel p-5"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-md ${
                    t.accent ? "bg-cm-accent/15 text-cm-accent" : t.warn ? "bg-yellow-500/15 text-yellow-400" : "bg-cm-panel2 text-cm-muted"
                  }`}
                >
                  <Icon size={19} />
                </div>
                {t.accent && <TrendingUp size={16} className="text-emerald-400" />}
              </div>
              <div className="mt-4">
                {metricsQ.isLoading ? (
                  <div className="h-8 w-24 animate-pulse rounded bg-cm-panel2" />
                ) : (
                  <div className={`font-heading text-3xl font-700 tracking-tight ${t.accent ? "text-cm-accent" : "text-cm-text"}`} data-testid={`metric-value-${t.key}`}>
                    {t.fmt(m[t.key])}
                  </div>
                )}
                <div className="mt-1 text-sm font-500 text-cm-text">{t.label}</div>
                <div className="mt-0.5 text-xs text-cm-muted">{t.hint}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {metricsQ.isError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Failed to load metrics. Check your API connection.
        </div>
      )}

      {/* Revenue (GMV) over time */}
      <div className="rounded-lg border border-cm-border bg-cm-panel p-5" data-testid="revenue-chart">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-base font-600 text-cm-text">Revenue (GMV) over time</h2>
          <span className="flex items-center gap-1.5 text-xs text-cm-muted"><TrendingUp size={13} className="text-cm-accent" /> INR ₹</span>
        </div>
        {series.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-cm-muted">No revenue in the selected period.</div>
        ) : (
          <div style={{ width: "100%", height: 224 }}>
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff7a2f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ff7a2f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#272e38" vertical={false} />
                <XAxis dataKey="label" stroke="#8b949e" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#272e38" }} />
                <YAxis stroke="#8b949e" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={54} tickFormatter={(v) => compactINR(v)} />
                <Tooltip
                  cursor={{ stroke: "#ff7a2f", strokeWidth: 1, strokeDasharray: "3 3" }}
                  contentStyle={{ background: "#171c22", border: "1px solid #272e38", borderRadius: 6, color: "#f8fafc" }}
                  labelStyle={{ color: "#8b949e" }}
                  formatter={(v) => [formatINR(v), "GMV"]}
                />
                <Area type="monotone" dataKey="gmv" stroke="#ff7a2f" strokeWidth={2} fill="url(#gmvFill)" dot={{ r: 3, fill: "#ff7a2f" }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent orders snapshot */}
        <div className="rounded-lg border border-cm-border bg-cm-panel lg:col-span-2">
          <div className="flex items-center justify-between border-b border-cm-border px-5 py-4">
            <h2 className="font-heading text-base font-600 text-cm-text">Recent Orders</h2>
            <Link to="/admin/orders" className="flex items-center gap-1 text-xs font-500 text-cm-accent hover:brightness-110" data-testid="view-all-orders">
              View all <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-cm-border">
            {ordersQ.isLoading && (
              <div className="flex items-center justify-center py-10 text-cm-muted"><Loader2 className="animate-spin" size={18} /></div>
            )}
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-cm-muted">{o.id}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-0.5 truncate text-sm text-cm-text">{o.item}</div>
                  <div className="truncate text-xs text-cm-muted">{o.vendor} → {o.buyer}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-600 text-cm-text">{formatINR(o.amount)}</div>
                  {o.rating > 0 && <div className="mt-1 flex justify-end"><StarRating value={o.rating} size={11} showValue={false} /></div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending KYC */}
        <div className="rounded-lg border border-cm-border bg-cm-panel">
          <div className="flex items-center justify-between border-b border-cm-border px-5 py-4">
            <h2 className="font-heading text-base font-600 text-cm-text">Pending KYC</h2>
            <Link to="/admin/vendors" className="flex items-center gap-1 text-xs font-500 text-cm-accent hover:brightness-110" data-testid="view-all-vendors">
              Review <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-cm-border">
            {vendorsQ.isLoading && (
              <div className="flex items-center justify-center py-10 text-cm-muted"><Loader2 className="animate-spin" size={18} /></div>
            )}
            {!vendorsQ.isLoading && pendingVendors.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-cm-muted">No pending approvals 🎉</div>
            )}
            {pendingVendors.map((v) => (
              <div key={v.id} className="px-5 py-3.5">
                <div className="truncate text-sm font-500 text-cm-text">{v.name}</div>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="text-xs text-cm-muted">{v.category} · {v.city}</span>
                  <span className="rounded border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-500 text-yellow-400">PENDING</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
