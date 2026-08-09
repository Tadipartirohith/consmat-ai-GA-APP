import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Search, Download, ChevronRight, CalendarIcon, X, Printer } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { StarRating } from "@/components/StarRating";
import { OrderDrawer } from "@/components/OrderDrawer";
import { exportToCsv } from "@/lib/csv";
import { openInvoiceWindow } from "@/lib/invoice";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

const toISO = (d) => (d ? d.toLocaleDateString("en-CA") : null);
const fmtShort = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

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

const FILTERS = ["all", "processing", "in_transit", "delivered", "cancelled"];

function fmtDate(s) {
  try {
    return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

export default function Orders() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [range, setRange] = useState(undefined);

  const start = toISO(range?.from);
  const end = toISO(range?.to);
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;

  const ordersQ = useQuery({
    queryKey: ["orders", start, end],
    queryFn: async () => (await api.get("/admin/orders", { params })).data,
  });

  const orders = (ordersQ.data || []).filter((o) => {
    const s = q.toLowerCase();
    const match = !s || o.id.toLowerCase().includes(s) || o.vendor.toLowerCase().includes(s) || o.buyer.toLowerCase().includes(s) || o.item.toLowerCase().includes(s);
    const f = filter === "all" || o.status === filter;
    return match && f;
  });

  const rangeLabel = range?.from
    ? range.to
      ? `${fmtShort(range.from)} – ${fmtShort(range.to)}`
      : fmtShort(range.from)
    : "Date range";

  const openOrder = (o) => {
    setSelected(o);
    setDrawerOpen(true);
  };

  const exportCsv = () => {
    exportToCsv(
      "consmat-orders.csv",
      [
        { label: "Order ID", value: "id" },
        { label: "Date", value: "created_at" },
        { label: "Item", value: "item" },
        { label: "Vendor", value: "vendor" },
        { label: "Buyer", value: "buyer" },
        { label: "Status", value: "status" },
        { label: "Rating", value: "rating" },
        { label: "Amount (INR)", value: "amount" },
      ],
      orders,
    );
    toast.success("Exported orders", { description: `${orders.length} rows downloaded as CSV.` });
  };

  const exportInvoices = () => {
    if (orders.length === 0) {
      toast.error("No orders", { description: "There are no orders in the current view to invoice." });
      return;
    }
    const ok = openInvoiceWindow(orders, `ConsMat Invoices (${orders.length})`);
    if (!ok) toast.error("Popup blocked", { description: "Allow popups to export invoices." });
    else toast.success("Generating invoices", { description: `${orders.length} invoice(s) opened for printing.` });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" data-testid="order-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-500 capitalize transition-colors ${
                filter === f
                  ? "border-cm-accent bg-cm-accent/10 text-cm-accent"
                  : "border-cm-border bg-cm-panel text-cm-muted hover:text-cm-text"
              }`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 lg:w-auto">
          <div className="relative w-full lg:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cm-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search orders…"
              data-testid="order-search-input"
              className="border-cm-border bg-cm-panel pl-9 text-cm-text placeholder:text-cm-muted focus-visible:ring-cm-accent"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                data-testid="date-range-trigger"
                className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-500 transition-colors ${
                  range?.from ? "border-cm-accent/50 bg-cm-accent/10 text-cm-accent" : "border-cm-border bg-cm-panel text-cm-muted hover:text-cm-text"
                }`}
              >
                <CalendarIcon size={15} />
                <span className="hidden whitespace-nowrap sm:inline">{rangeLabel}</span>
                {range?.from && (
                  <X
                    size={14}
                    data-testid="date-range-clear"
                    onClick={(e) => { e.stopPropagation(); setRange(undefined); }}
                    className="ml-1 hover:text-cm-text"
                  />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto border-cm-border bg-cm-panel p-0" align="end">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                numberOfMonths={1}
                defaultMonth={new Date(2026, 5, 1)}
                data-testid="date-range-calendar"
                className="text-cm-text"
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={exportCsv}
            data-testid="export-orders-csv"
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-cm-border bg-cm-panel px-3 py-2 text-sm font-500 text-cm-muted transition-colors hover:border-cm-accent/40 hover:text-cm-accent"
          >
            <Download size={15} /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={exportInvoices}
            data-testid="export-invoices-button"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-cm-accent px-3 py-2 text-sm font-600 text-black transition-all hover:brightness-110 active:scale-95"
          >
            <Printer size={15} /> <span className="hidden sm:inline">Invoices ({orders.length})</span>
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-cm-border bg-cm-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm" data-testid="orders-table">
            <thead>
              <tr className="border-b border-cm-border text-left text-xs uppercase tracking-wide text-cm-muted">
                <th className="px-5 py-3 font-500">Order</th>
                <th className="px-5 py-3 font-500">Item</th>
                <th className="px-5 py-3 font-500">Vendor / Buyer</th>
                <th className="px-5 py-3 font-500">Status</th>
                <th className="px-5 py-3 font-500">Rating</th>
                <th className="px-5 py-3 font-500 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {ordersQ.isLoading && (
                <tr><td colSpan={6} className="py-14 text-center text-cm-muted"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
              )}
              {ordersQ.isError && (
                <tr><td colSpan={6} className="py-14 text-center text-red-300">Failed to load orders.</td></tr>
              )}
              {!ordersQ.isLoading && orders.length === 0 && (
                <tr><td colSpan={6} className="py-14 text-center text-cm-muted">No orders found.</td></tr>
              )}
              {orders.map((o, i) => (
                <motion.tr
                  key={o.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  data-testid={`order-row-${o.id}`}
                  onClick={() => openOrder(o)}
                  className="cursor-pointer border-b border-cm-border/60 transition-colors last:border-0 hover:bg-cm-panel2/50"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-xs text-cm-text">{o.id}</div>
                    <div className="text-xs text-cm-muted">{fmtDate(o.created_at)}</div>
                  </td>
                  <td className="px-5 py-3.5 max-w-[220px]"><div className="truncate text-cm-text">{o.item}</div></td>
                  <td className="px-5 py-3.5">
                    <div className="text-cm-text">{o.vendor}</div>
                    <div className="text-xs text-cm-muted">{o.buyer}</div>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={o.status} /></td>
                  <td className="px-5 py-3.5">{o.rating > 0 ? <StarRating value={o.rating} size={12} /> : <span className="text-xs text-cm-muted">—</span>}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-mono font-600 text-cm-text">{formatINR(o.amount)}</span>
                      <ChevronRight size={16} className="text-cm-muted" />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <OrderDrawer order={selected} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
