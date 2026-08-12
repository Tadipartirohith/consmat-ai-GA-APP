import React, { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { formatINR, titleCase } from "@/lib/format";
import { g, statusBucket, orderId, getStepDate, STATUS_STEPS } from "@/lib/orderStatus";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveTracking } from "@/components/LiveTracking";
import { ComplaintDialog } from "@/components/ComplaintDialog";
import { RateDialog } from "@/components/RateDialog";
import { toast } from "sonner";
import {
  Receipt,
  Package,
  ChevronRight,
  Truck,
  MapPin,
  Store,
  Check,
  PackageCheck,
  RotateCcw,
  Search,
  RefreshCw,
  LifeBuoy,
  Star,
} from "lucide-react";

const STEP_ICONS = { placed: Check, dispatched: Truck, delivered: PackageCheck };
const TIMELINE = STATUS_STEPS.map((s) => ({ ...s, icon: STEP_ICONS[s.key] }));

const STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "placed", label: "Placed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

export function OrdersSheet({ open, onOpenChange }) {
  const { orders, ordersError, refreshOrders, markOrdersSeen, orderUpdate, focusOrderId, setFocusOrderId } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (open) {
      markOrdersSeen();
      refreshOrders();
    }
  }, [open, markOrdersSeen, refreshOrders]);

  // Jump-to-order from the alert center.
  useEffect(() => {
    if (open && focusOrderId) {
      setSelectedId(focusOrderId);
      setFocusOrderId(null);
    }
  }, [open, focusOrderId, setFocusOrderId]);

  const selected = selectedId
    ? (orders || []).find((o) => orderId(o) === selectedId) || null
    : null;
  const updatedAt =
    selected && orderUpdate.id === orderId(selected) ? orderUpdate.at : 0;

  const counts = React.useMemo(() => {
    const c = { all: (orders || []).length, placed: 0, dispatched: 0, delivered: 0 };
    (orders || []).forEach((o) => {
      const b = statusBucket(o);
      if (c[b] !== undefined) c[b] += 1;
    });
    return c;
  }, [orders]);

  const q = query.trim().toLowerCase();
  const filtered = (orders || []).filter((o) => {
    if (statusFilter !== "all" && statusBucket(o) !== statusFilter) return false;
    if (!q) return true;
    const status = String(g(o, ["status", "state"], "")).toLowerCase();
    const id = orderId(o).toLowerCase();
    const items = g(o, ["items", "lines", "materials"], []);
    const mats = (Array.isArray(items) ? items : [])
      .map((it) => String(g(it, ["material", "name", "item"], "")).toLowerCase())
      .join(" ");
    return status.includes(q) || id.includes(q) || mats.includes(q);
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          data-testid="orders-sheet"
          className="flex w-full flex-col border-white/10 bg-[#0f1216] text-white sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle className="font-head flex items-center gap-2 text-xl text-white">
              <Receipt size={20} className="text-[#ff7a2f]" /> Order History
            </SheetTitle>
          </SheetHeader>

          <div className="relative pt-3">
            <Search size={16} className="absolute left-3 top-1/2 mt-1.5 -translate-y-1/2 text-white/40" />
            <Input
              data-testid="order-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by material or status..."
              className="border-white/10 bg-[#171c22] pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-3">
            {STATUS_CHIPS.map((c) => {
              const active = statusFilter === c.key;
              const count = counts[c.key] ?? 0;
              return (
                <button
                  key={c.key}
                  data-testid={`status-chip-${c.key}`}
                  onClick={() => setStatusFilter(c.key)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#ff7a2f] text-black"
                      : "border border-white/10 bg-[#171c22] text-white/60 hover:text-white"
                  }`}
                >
                  {c.label}
                  <span
                    data-testid={`status-chip-count-${c.key}`}
                    className={`rounded-full px-1.5 text-[10px] font-bold ${
                      active ? "bg-black/20 text-black" : "bg-white/10 text-white/70"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {orders === null ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl bg-[#171c22]" />)
            ) : ordersError && (orders || []).length === 0 ? (
              <p className="py-16 text-center text-sm text-white/50">{ordersError}</p>
            ) : filtered.length > 0 ? (
              filtered.map((o, i) => {
                const items = g(o, ["items", "lines", "materials"], []);
                return (
                  <button
                    key={orderId(o) || i}
                    data-testid={`order-row-${i}`}
                    onClick={() => setSelectedId(orderId(o))}
                    className="group w-full rounded-xl border border-white/10 bg-[#171c22] p-4 text-left transition-colors hover:border-[#ff7a2f]/50 animate-fade-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-sm text-[#ff7a2f]">
                        #{g(o, ["order_id", "id", "orderId"], i + 1)}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">
                          {titleCase(g(o, ["status", "state"], "placed"))}
                        </span>
                        <ChevronRight size={16} className="text-white/30 group-hover:text-[#ff7a2f]" />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm text-white/60">
                        <Package size={14} /> {Array.isArray(items) ? items.length : 0} item(s)
                      </span>
                      <span className="font-mono font-bold">
                        {formatINR(g(o, ["total", "amount", "total_cost", "grand_total"]))}
                      </span>
                    </div>
                    {g(o, ["payment_method", "payment"], null) && (
                      <p className="mt-1 text-xs uppercase tracking-wider text-white/40">
                        {g(o, ["payment_method", "payment"])}
                      </p>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="py-16 text-center text-sm text-white/50">
                {(orders || []).length > 0 ? "No orders match your search." : "No orders yet."}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <OrderDetailDialog order={selected} updatedAt={updatedAt} onClose={() => setSelectedId(null)} />
    </>
  );
}

function OrderDetailDialog({ order, updatedAt, onClose }) {
  const { addToCart, setCartOpen, setOrdersOpen } = useApp();
  const [pulse, setPulse] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  useEffect(() => {
    if (!updatedAt) return;
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 3000);
    return () => clearTimeout(t);
  }, [updatedAt]);

  // Collapse the live map whenever a different order is opened.
  useEffect(() => {
    setTracking(false);
  }, [order && orderId(order)]);

  if (!order) return null;
  const items = g(order, ["items", "lines", "materials"], []);
  const rawStatus = String(g(order, ["status", "state"], "placed")).toLowerCase();
  const canTrack = ["dispatched", "in_transit", "out", "delivered", "shipped"].some((s) =>
    rawStatus.includes(s)
  );
  const status = titleCase(rawStatus);
  const address = g(order, ["address", "location", "delivery_location"], null);
  const payment = g(order, ["payment_method", "payment"], null);
  const total = g(order, ["total", "amount", "total_cost", "grand_total"]);

  const reorder = () => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return;
    list.forEach((it) =>
      addToCart({
        material: g(it, ["material", "name", "item"], ""),
        quantity: g(it, ["quantity", "qty"], 1),
        unit: g(it, ["unit", "uom"], "units"),
        vendor: g(it, ["vendor", "vendor_name", "supplier"], null),
        price: g(it, ["price", "landed_price", "cost", "amount"], null),
      })
    );
    onClose();
    toast.success(`Re-added ${list.length} item(s) to cart`, {
      action: {
        label: "View cart",
        onClick: () => {
          setOrdersOpen(false);
          setCartOpen(true);
        },
      },
    });
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="order-detail-modal"
        className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#171c22] text-white sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-head flex items-center justify-between text-xl">
            <span className="font-mono text-[#ff7a2f]">
              #{g(order, ["order_id", "id", "orderId"], "—")}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{status}</span>
          </DialogTitle>
        </DialogHeader>

        <StatusTimeline status={rawStatus} order={order} />

        {canTrack && (
          <div>
            <Button
              data-testid="track-order-btn"
              onClick={() => setTracking((t) => !t)}
              variant="outline"
              className="w-full border-[#ff7a2f]/40 bg-[#ff7a2f]/10 text-[#ff7a2f] hover:bg-[#ff7a2f]/20"
            >
              <Truck size={16} className="mr-1.5" />
              {tracking ? "Hide live tracking" : "Track live location"}
            </Button>
            {tracking && (
              <div className="mt-3">
                <LiveTracking orderId={g(order, ["order_id", "id", "orderId"])} />
              </div>
            )}
          </div>
        )}

        {pulse && (
          <div
            data-testid="order-updated-pulse"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#22c55e] animate-fade-up"
          >
            <RefreshCw size={13} className="animate-spin" style={{ animationDuration: "1.2s" }} />
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
            </span>
            Updated just now
          </div>
        )}

        {address && (
          <div className="flex items-center gap-2 rounded-lg bg-black/25 p-3 text-sm text-white/70">
            <MapPin size={15} className="text-white/40" /> {titleCase(String(address))}
          </div>
        )}

        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">Items</p>
          <div className="space-y-2">
            {(Array.isArray(items) ? items : []).map((it, i) => (
              <div
                key={i}
                data-testid={`order-item-${i}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0f1216] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {titleCase(g(it, ["material", "name", "item"], "—"))}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-white/50">
                    {g(it, ["vendor", "vendor_name", "supplier"], null) && (
                      <>
                        <Store size={12} /> {g(it, ["vendor", "vendor_name", "supplier"])} ·{" "}
                      </>
                    )}
                    {g(it, ["quantity", "qty"], 1)} {g(it, ["unit", "uom"], "units")}
                  </p>
                </div>
                <span className="font-mono">
                  {formatINR(g(it, ["price", "landed_price", "cost", "amount"]))}
                </span>
              </div>
            ))}
            {(!items || items.length === 0) && (
              <p className="py-4 text-center text-sm text-white/40">No line items on this order.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-sm text-white/60">
            {payment ? <span className="uppercase tracking-wider">{payment}</span> : "Total"}
          </span>
          <span className="font-mono text-lg font-bold text-[#ff7a2f]">{formatINR(total)}</span>
        </div>

        <div className="flex gap-2">
          <Button
            data-testid="reorder-btn"
            onClick={reorder}
            disabled={!Array.isArray(items) || items.length === 0}
            className="flex-1 bg-[#ff7a2f] font-semibold text-black hover:bg-[#e66822]"
          >
            <RotateCcw size={16} className="mr-1.5" /> Reorder
          </Button>
          <Button
            data-testid="report-issue-btn"
            onClick={() => setComplaintOpen(true)}
            variant="outline"
            className="flex-1 border-white/15 bg-transparent text-white/80 hover:bg-white/5"
          >
            <LifeBuoy size={16} className="mr-1.5" /> Report an issue
          </Button>
        </div>

        {rawStatus.includes("deliver") && (
          <Button
            data-testid="rate-order-btn"
            onClick={() => setRateOpen(true)}
            variant="outline"
            className="w-full border-[#ff7a2f]/40 bg-[#ff7a2f]/10 text-[#ff7a2f] hover:bg-[#ff7a2f]/20"
          >
            <Star size={16} className="mr-1.5" /> Rate vendors & products
          </Button>
        )}

        <ComplaintDialog
          open={complaintOpen}
          onOpenChange={setComplaintOpen}
          orderId={g(order, ["order_id", "id", "orderId"])}
        />
        <RateDialog
          open={rateOpen}
          onOpenChange={setRateOpen}
          orderId={g(order, ["order_id", "id", "orderId"])}
          targets={(() => {
            const arr = Array.isArray(items) ? items : [];
            const oid = g(order, ["order_id", "id", "orderId"]);
            const vendors = new Map();
            const products = new Map();
            arr.forEach((it) => {
              const vid = g(it, ["vendor_id"]);
              const vname = g(it, ["vendor", "vendor_name"]);
              if (vid && !vendors.has(vid)) vendors.set(vid, { kind: "vendor", id: vid, name: vname });
              const mid = g(it, ["material_id"]);
              const mname = g(it, ["material", "name"]);
              if (mid && !products.has(mid)) products.set(mid, { kind: "product", id: mid, name: mname });
            });
            const delivery = oid ? [{ kind: "delivery", id: oid, name: "Delivery experience" }] : [];
            return [...delivery, ...vendors.values(), ...products.values()];
          })()}
        />
      </DialogContent>
    </Dialog>
  );
}

function StatusTimeline({ status, order }) {
  let current = 0;
  TIMELINE.forEach((step, i) => {
    if (step.match.some((m) => status.includes(m))) current = i;
  });
  if (status.includes("cancel")) current = -1;

  return (
    <div className="flex items-start py-2" data-testid="order-timeline">
      {TIMELINE.map((step, i) => {
        const Icon = step.icon;
        const done = i <= current;
        const date = getStepDate(order, step.key, step.match);
        const isFuture = i > current;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                  done
                    ? "border-[#ff7a2f] bg-[#ff7a2f] text-black"
                    : "border-white/20 bg-transparent text-white/30"
                }`}
              >
                <Icon size={16} />
              </div>
              <span className={`text-[11px] font-semibold ${done ? "text-white" : "text-white/40"}`}>
                {step.label}
              </span>
              {date && (
                <span
                  data-testid={`timeline-date-${step.key}`}
                  className={`text-[10px] leading-tight ${
                    done ? "text-white/60" : "text-[#ff7a2f]/80"
                  }`}
                >
                  {isFuture ? "Est. " : ""}
                  {date}
                </span>
              )}
            </div>
            {i < TIMELINE.length - 1 && (
              <div
                className={`mx-1 mt-4 h-0.5 flex-1 rounded-full ${
                  i < current ? "bg-[#ff7a2f]" : "bg-white/15"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
