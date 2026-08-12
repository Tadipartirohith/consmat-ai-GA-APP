import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Clock, IndianRupee, User, Package, ChevronRight, Check, Truck, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateOrderStatus } from "@/lib/api";
import { LiveTracking } from "@/components/LiveTracking";
import { ComplaintDialog } from "@/components/ComplaintDialog";
import { LifeBuoy } from "lucide-react";
import { formatINR, pick } from "@/lib/format";
import { toast } from "sonner";

const statusStyles = (status = "") => {
  const s = String(status).toLowerCase();
  if (s.includes("pend") || s.includes("new")) return "bg-[#ff7a2f]/15 text-[#ff7a2f]";
  if (s.includes("complet") || s.includes("deliver") || s.includes("fulfil"))
    return "bg-emerald-500/15 text-emerald-400";
  if (s.includes("cancel") || s.includes("reject")) return "bg-[#ef4444]/15 text-[#ef4444]";
  if (s.includes("ship") || s.includes("process")) return "bg-sky-500/15 text-sky-400";
  return "bg-white/10 text-[#94a3b8]";
};

const itemName = (it) =>
  pick(it, ["name", "title", "product_name", "product", "item_name", "offer_name"], "Item");
const itemQty = (it) => pick(it, ["quantity", "qty", "count", "units"], 1);
const itemPrice = (it) => pick(it, ["price", "unit_price", "amount", "cost"], 0);

const getTimeline = (order) => {
  const hist = pick(order, ["status_history", "history", "timeline", "events", "status_timeline"]);
  if (!Array.isArray(hist)) return null;
  return hist.map((h) => ({
    status: pick(h, ["status", "state", "label", "event"], "—"),
    at: pick(h, ["at", "timestamp", "time", "date", "created_at", "updated_at", "changed_at"]),
    note: pick(h, ["note", "message", "description"]),
  }));
};

const statusGroup = (order) => {
  const s = String(pick(order, ["status", "state"], "")).toLowerCase();
  if (s.includes("fulfil") || s.includes("complet") || s.includes("deliver")) return "fulfilled";
  if (s.includes("accept") || s.includes("process") || s.includes("ship")) return "accepted";
  if (s.includes("cancel") || s.includes("reject")) return "cancelled";
  return "pending";
};

const OrderCard = ({ order, index }) => {
  const [open, setOpen] = useState(false);
  const [showTrack, setShowTrack] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const id = pick(order, ["id", "_id", "order_id", "reference"], `#${index + 1}`);
  const orderApiId = pick(order, ["id", "_id", "order_id", "reference"]);
  const status = pick(order, ["status", "state"], "pending");
  const total = pick(order, ["total", "amount", "total_amount", "grand_total", "price"], 0);
  const customer = pick(order, ["customer_name", "customer", "buyer", "user_name", "user"]);
  const phone = pick(order, ["customer_phone", "phone", "contact"]);
  const addressVal = pick(order, ["address", "delivery_address", "shipping_address", "location"]);
  const createdAt = pick(order, ["created_at", "createdAt", "date", "placed_at", "timestamp"]);
  const items = pick(order, ["items", "line_items", "offers", "products"], []);
  const itemList = Array.isArray(items) ? items : [];
  const itemCount = Array.isArray(items) ? items.length : items;
  const label = typeof id === "string" && id.startsWith("#") ? id : `#${String(id).slice(-8)}`;

  const s = String(status).toLowerCase();
  const isDone = s.includes("fulfil") || s.includes("complet") || s.includes("deliver") || s.includes("cancel");
  const isPendingNew = s.includes("pend") || s.includes("new");

  const rawTl = getTimeline(order);
  const timeline =
    rawTl && rawTl.length
      ? rawTl
      : [
          { status: "Placed", at: createdAt },
          ...(!isPendingNew ? [{ status, at: undefined }] : []),
        ];
  const displayTl = [...timeline].reverse();

  const statusMutation = useMutation({
    mutationFn: (newStatus) => updateOrderStatus(orderApiId, newStatus, note.trim()),
    onSuccess: (_data, newStatus) => {
      toast.success(`Order marked ${newStatus}`);
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-me"] });
      setOpen(false);
    },
    onError: (err) =>
      toast.error(err?.response?.data?.detail || err.message || "Failed to update order"),
  });

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.04 }}
        className="w-full rounded-lg border border-white/10 bg-[#0f1216] p-4 text-left transition-colors duration-200 hover:border-[#ff7a2f]/40 hover:bg-white/[0.02]"
        data-testid={`order-card-${id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-sm font-bold tracking-tight text-white">Order {label}</p>
            {customer && <p className="mt-0.5 truncate text-sm text-[#94a3b8]">{customer}</p>}
          </div>
          <Badge className={`shrink-0 border-0 capitalize ${statusStyles(status)}`} data-testid={`order-status-${id}`}>
            {String(status)}
          </Badge>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
          <div className="flex items-center gap-3 text-[#94a3b8]">
            {Array.isArray(items) && (
              <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            )}
            {createdAt && (
              <span className="flex items-center gap-1">
                <Clock size={13} /> {String(createdAt).slice(0, 10)}
              </span>
            )}
          </div>
          <span className="flex items-center font-semibold tabular-nums text-white">
            <IndianRupee size={14} className="text-[#ff7a2f]" />
            {formatINR(total).replace("₹ ", "")}
            <ChevronRight size={16} className="ml-1 text-[#94a3b8]" />
          </span>
        </div>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#171c22] border-white/10 text-white" data-testid={`order-detail-${id}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between font-heading tracking-tight">
              <span>Order {label}</span>
              <Badge className={`border-0 capitalize ${statusStyles(status)}`}>{String(status)}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {(customer || phone || addressVal || createdAt) && (
              <div className="rounded-md border border-white/10 bg-[#0f1216] p-3 text-sm">
                {customer && (
                  <div className="flex items-center gap-2 text-white">
                    <User size={14} className="text-[#ff7a2f]" /> {customer}
                  </div>
                )}
                {phone && <p className="mt-1 text-[#94a3b8]">{phone}</p>}
                {addressVal && <p className="mt-1 text-[#94a3b8]">{addressVal}</p>}
                {createdAt && (
                  <p className="mt-1 flex items-center gap-1 text-[#94a3b8]">
                    <Clock size={12} /> {String(createdAt).slice(0, 19).replace("T", " ")}
                  </p>
                )}
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Items</p>
              {itemList.length === 0 ? (
                <p className="text-sm text-[#94a3b8]" data-testid="order-detail-no-items">
                  No line items available for this order.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {itemList.map((it, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border border-white/10 bg-[#0f1216] px-3 py-2 text-sm"
                      data-testid={`order-item-${id}-${i}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Package size={14} className="shrink-0 text-[#94a3b8]" />
                        <span className="truncate text-white">{itemName(it)}</span>
                        <span className="shrink-0 text-[#94a3b8]">× {itemQty(it)}</span>
                      </div>
                      <span className="shrink-0 tabular-nums text-white">{formatINR(itemPrice(it))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Status Timeline</p>
              <div data-testid={`order-timeline-${id}`}>
                {displayTl.map((t, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${i === 0 ? "bg-[#ff7a2f]" : "bg-white/25"}`} />
                      {i < displayTl.length - 1 && <span className="w-px flex-1 bg-white/10" />}
                    </div>
                    <div className="pb-3">
                      <p className={`text-sm capitalize ${i === 0 ? "text-white" : "text-[#94a3b8]"}`}>{String(t.status)}</p>
                      {t.at && (
                        <p className="text-xs text-[#94a3b8]">
                          {String(t.at).slice(0, 19).replace("T", " ")}
                        </p>
                      )}
                      {t.note && <p className="text-xs text-[#94a3b8]">{t.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {orderApiId != null && (s.includes("accept") || s.includes("ship") || s.includes("dispatch") || s.includes("fulfil") || s.includes("deliver")) && (
              <div className="border-t border-white/10 pt-3">
                <Button
                  onClick={() => setShowTrack((v) => !v)}
                  data-testid={`track-order-btn-${id}`}
                  className="w-full border border-[#ff7a2f]/40 bg-[#ff7a2f]/10 text-[#ff7a2f] hover:bg-[#ff7a2f]/20"
                >
                  <Truck size={15} className="mr-1.5" />
                  {showTrack ? "Hide delivery tracking" : "Track delivery"}
                </Button>
                {showTrack && (
                  <div className="mt-3">
                    <LiveTracking orderId={orderApiId} />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-[#94a3b8]">Total</span>
              <span className="font-heading text-lg font-bold text-[#ff7a2f]" data-testid={`order-detail-total-${id}`}>
                {formatINR(total)}
              </span>
            </div>

            {orderApiId != null && (
              <button
                data-testid={`vendor-report-issue-${id}`}
                onClick={() => setComplaintOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-white/10 py-2 text-sm text-[#94a3b8] transition-colors hover:border-[#ff7a2f]/40 hover:text-white"
              >
                <LifeBuoy size={15} /> Report an issue with this order
              </button>
            )}
            <ComplaintDialog open={complaintOpen} onOpenChange={setComplaintOpen} orderId={orderApiId} />

            {orderApiId != null && !isDone && (
              <div className="space-y-2 border-t border-white/10 pt-3">
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  data-testid={`order-note-input-${id}`}
                  placeholder="Add a note (optional)…"
                  className="bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
                />
                <div className="flex gap-2">
                  {isPendingNew && (
                    <Button
                      onClick={() => statusMutation.mutate("accepted")}
                      disabled={statusMutation.isPending}
                      data-testid={`accept-order-btn-${id}`}
                      className="flex-1 border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      {statusMutation.isPending ? (
                        <Loader2 size={15} className="mr-1.5 animate-spin" />
                      ) : (
                        <Check size={15} className="mr-1.5" />
                      )}
                      Accept
                    </Button>
                  )}
                  <Button
                    onClick={() => statusMutation.mutate("fulfilled")}
                    disabled={statusMutation.isPending}
                    data-testid={`fulfill-order-btn-${id}`}
                    className="flex-1 bg-[#ff7a2f] font-semibold text-[#0f1216] hover:brightness-110"
                  >
                    {statusMutation.isPending ? (
                      <Loader2 size={15} className="mr-1.5 animate-spin" />
                    ) : (
                      <Truck size={15} className="mr-1.5" />
                    )}
                    Mark Fulfilled
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const OrdersList = ({ orders = [] }) => {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const q = search.trim().toLowerCase();

  const counts = { all: orders.length, pending: 0, accepted: 0, fulfilled: 0 };
  orders.forEach((o) => {
    const g = statusGroup(o);
    if (counts[g] !== undefined) counts[g] += 1;
  });

  const filtered = orders.filter((o) => {
    const cust = String(
      pick(o, ["customer_name", "customer", "buyer", "user_name", "user"], "")
    ).toLowerCase();
    const oid = String(pick(o, ["id", "_id", "order_id", "reference"], "")).toLowerCase();
    const matchSearch = !q || cust.includes(q) || oid.includes(q);
    const matchTab = statusTab === "all" || statusGroup(o) === statusTab;
    return matchSearch && matchTab;
  });

  const tabs = [
    ["all", "All"],
    ["pending", "Pending"],
    ["accepted", "Accepted"],
    ["fulfilled", "Fulfilled"],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="rounded-lg border border-white/10 bg-[#171c22] p-4 sm:p-5"
      data-testid="orders-panel"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold tracking-tight">Incoming Orders</h2>
          <p className="text-sm text-[#94a3b8]">Stock auto-decrements on new orders</p>
        </div>
        <span className="rounded-md bg-[#ff7a2f]/10 px-2.5 py-1 text-sm font-semibold text-[#ff7a2f]" data-testid="orders-count">
          {orders.length}
        </span>
      </div>

      {orders.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5" data-testid="order-status-tabs">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusTab(key)}
                data-testid={`order-tab-${key}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  statusTab === key
                    ? "bg-[#ff7a2f] text-[#0f1216]"
                    : "border border-white/10 bg-[#0f1216] text-[#94a3b8] hover:bg-white/5"
                }`}
              >
                {label} <span className="opacity-70">{counts[key] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="orders-search-input"
              placeholder="Search by customer or order id…"
              className="pl-9 bg-[#0f1216] border-white/10 text-white focus-visible:ring-1 focus-visible:ring-[#ff7a2f]"
            />
          </div>
        </>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center" data-testid="orders-empty">
          <Inbox size={32} className="text-white/20" />
          <p className="font-medium text-white">No orders yet</p>
          <p className="mx-auto max-w-xs text-sm text-[#94a3b8]">
            New customer orders will appear here automatically. Stock is deducted for each order as it comes in.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center" data-testid="orders-no-results">
          <Search size={32} className="text-white/20" />
          <p className="text-[#94a3b8]">No orders match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((order, i) => (
            <OrderCard key={i} order={order} index={i} />
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default OrdersList;
