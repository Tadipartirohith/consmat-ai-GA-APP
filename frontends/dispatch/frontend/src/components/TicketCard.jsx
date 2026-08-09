import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Storefront,
  MapPin,
  Phone,
  Package,
  Truck,
  CheckCircle,
  CircleNotch,
  ClockCountdown,
  Timer,
} from "@phosphor-icons/react";
import { formatINR, api } from "@/lib/api";
import StarRating from "@/components/StarRating";
import StatusBadge from "@/components/StatusBadge";
import DeliveryProofDialog from "@/components/DeliveryProofDialog";

const timeAgo = (iso) => {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "just now";
  if (diff < 60) return `${Math.round(diff)}m ago`;
  return `${Math.round(diff / 60)}h ago`;
};

function EtaCountdown({ etaAt, orderId, onOverdue }) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!etaAt) return null;
  const ms = new Date(etaAt).getTime() - now;
  const overdue = ms < 0;
  if (overdue && !firedRef.current) {
    firedRef.current = true;
    onOverdue?.(orderId);
  }
  const abs = Math.abs(ms);
  const mm = String(Math.floor(abs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((abs % 60000) / 1000)).padStart(2, "0");
  return (
    <div
      data-testid="eta-countdown"
      className={`mb-3 flex items-center justify-between border px-3 py-2 ${
        overdue
          ? "border-red-500/50 bg-red-500/10 text-red-300"
          : "border-blue-500/40 bg-blue-500/10 text-blue-300"
      }`}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
        <Timer size={13} weight="fill" className={overdue ? "animate-pulse-dot" : ""} />
        {overdue ? "Overdue by" : "Delivery ETA"}
      </span>
      <span className="font-mono text-sm font-bold tabular-nums">
        {overdue ? "+" : ""}{mm}:{ss}
      </span>
    </div>
  );
}

export default function TicketCard({ ticket, onUpdated, onOverdue }) {
  const [busy, setBusy] = useState("");
  const [showProof, setShowProof] = useState(false);
  const id = ticket.order_id;

  const run = async (action) => {
    setBusy(action);
    try {
      const res = await api.dispatch(id);
      toast.success(`${id} dispatched`);
      onUpdated?.(res.ticket || { ...ticket, status: res.status });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Action failed");
    } finally {
      setBusy("");
    }
  };

  const confirmDeliver = async (proof) => {
    try {
      const res = await api.deliver(id, proof);
      toast.success(`${id} marked delivered`);
      onUpdated?.(res.ticket || { ...ticket, status: "delivered" });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Delivery failed");
      throw err;
    }
  };

  const isPending = ticket.status === "pending";
  const isDispatched = ticket.status === "dispatched";
  const isDelivered = ticket.status === "delivered";

  return (
    <div
      data-testid={`ticket-card-${id}`}
      className={`flex flex-col border bg-[#171c22] animate-fade-up ${
        ticket.overdue ? "border-red-500/40" : "border-white/10"
      }`}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-white" data-testid={`ticket-id-${id}`}>
              {id}
            </span>
            {ticket.priority === "high" && (
              <span className="font-mono text-[9px] font-bold tracking-wider text-[#ff7a2f] border border-[#ff7a2f]/40 px-1.5 py-0.5">
                HIGH
              </span>
            )}
          </div>
          <p className="mt-1 truncate font-head font-semibold text-white/90 text-[15px]">
            {ticket.customer?.name}
          </p>
        </div>
        <StatusBadge status={ticket.status} testId={`ticket-status-${id}`} />
      </div>

      {/* customer meta */}
      <div className="space-y-1.5 border-b border-white/10 px-4 py-3 text-xs text-white/60">
        <p className="flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-white/35" />
          <span className="leading-snug">{ticket.customer?.address}</span>
        </p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Phone size={13} className="text-white/35" />
            <span className="font-mono">{ticket.customer?.phone}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <ClockCountdown size={13} className="text-white/35" />
            {timeAgo(ticket.placed_at)}
          </span>
        </div>
      </div>

      {/* vendors */}
      <div className="flex-1 divide-y divide-white/10">
        {ticket.vendors?.map((v) => (
          <div key={v.vendor_id + v.vendor_name} className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-white/85">
                <Storefront size={14} className="text-[#ff7a2f]" />
                {v.vendor_name}
              </span>
              <StarRating value={v.rating} testId={`vendor-rating-${id}-${v.vendor_id}`} />
            </div>
            <ul className="space-y-1">
              {v.items?.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-white/70">
                    <Package size={12} className="text-white/30" />
                    {it.name}
                  </span>
                  <span className="font-mono text-white/55 whitespace-nowrap">
                    {it.qty} {it.unit} · {formatINR(it.price)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 text-right font-mono text-[11px] text-white/40">
              subtotal {formatINR(v.subtotal)}
            </div>
          </div>
        ))}
      </div>

      {/* footer / total + actions */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-end justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
            {ticket.vendor_count} vendors · {ticket.item_count} items
          </span>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">
              Order total
            </p>
            <p className="font-mono text-lg font-bold text-[#ff7a2f]" data-testid={`ticket-total-${id}`}>
              {formatINR(ticket.total)}
            </p>
          </div>
        </div>

        {isDispatched && (
          <EtaCountdown etaAt={ticket.eta_at} orderId={id} onOverdue={onOverdue} />
        )}

        {isDelivered ? (
          <div className="space-y-2">
            {ticket.proof && (
              <div
                data-testid={`proof-thumb-${id}`}
                className="flex items-center gap-3 border border-white/10 bg-[#0f1216] p-2"
              >
                <img
                  src={ticket.proof}
                  alt="delivery proof"
                  className="h-14 w-14 shrink-0 border border-white/10 object-cover"
                />
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    {ticket.proof_type === "signature" ? "Signature captured" : "Photo captured"}
                  </p>
                  {ticket.note && (
                    <p className="mt-0.5 truncate text-xs text-white/60">“{ticket.note}”</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-400">
              <CheckCircle size={16} weight="fill" /> Delivered
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              data-testid={`dispatch-btn-${id}`}
              onClick={() => run("dispatch")}
              disabled={!isPending || busy}
              className="flex items-center justify-center gap-1.5 bg-[#ff7a2f] py-2.5 font-head text-xs font-bold tracking-wide text-[#0f1216] transition-colors hover:bg-[#ff8c4d] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a2f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#171c22]"
            >
              {busy === "dispatch" ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <Truck size={14} weight="bold" />
              )}
              DISPATCH
            </button>
            <button
              data-testid={`deliver-btn-${id}`}
              onClick={() => setShowProof(true)}
              disabled={!isDispatched || busy}
              className="flex items-center justify-center gap-1.5 border border-emerald-500/50 py-2.5 font-head text-xs font-bold tracking-wide text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171c22]"
            >
              <CheckCircle size={14} weight="bold" />
              DELIVERED
            </button>
          </div>
        )}
      </div>

      <DeliveryProofDialog
        open={showProof}
        onOpenChange={setShowProof}
        orderId={id}
        onConfirm={confirmDeliver}
      />
    </div>
  );
}
