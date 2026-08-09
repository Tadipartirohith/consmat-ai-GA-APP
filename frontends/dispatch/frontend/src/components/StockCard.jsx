import { useState } from "react";
import { toast } from "sonner";
import {
  CaretDown,
  Package,
  Storefront,
  Warning,
  ArrowUUpLeft,
  Lightning,
  CircleNotch,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import { formatINR, stockLevel, api } from "@/lib/api";
import StarRating from "@/components/StarRating";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const LEVEL = {
  out: { label: "OUT OF STOCK", color: "#ef4444" },
  low: { label: "LOW STOCK", color: "#f59e0b" },
};

const DEFAULT_QTY = { bags: 1000, tonnes: 40, units: 100, kg: 500, pcs: 50000 };

export default function StockCard({ product, onReordered }) {
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [vendorId, setVendorId] = useState(null);
  const [qty, setQty] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const total = product.total_available ?? 0;
  const minPrice = Math.min(...(product.vendors || []).map((v) => v.price));
  const level = stockLevel(product);
  const badge = LEVEL[level];

  const openPicker = (vendor) => {
    const preferred =
      vendor?.vendor_id ||
      [...(product.vendors || [])].sort((a, b) => a.stock - b.stock)[0]?.vendor_id;
    setVendorId(preferred);
    setQty(DEFAULT_QTY[product.unit] ?? 100);
    setPickerOpen(true);
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      const res = await api.reorder({
        product_id: product.product_id,
        vendor_id: vendorId,
        qty: Number(qty) || undefined,
      });
      toast.success(
        `Reorder ${res.reorder_id}: ${res.qty.toLocaleString("en-IN")} ${res.unit} → ${res.vendor_name}`
      );
      setPickerOpen(false);
      onReordered?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reorder failed");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedVendor = (product.vendors || []).find((v) => v.vendor_id === vendorId);
  const step = product.unit === "pcs" ? 1000 : product.unit === "tonnes" ? 5 : 10;

  return (
    <div
      data-testid={`stock-card-${product.product_id}`}
      className={`border bg-[#171c22] animate-fade-up ${
        level === "out" ? "border-red-500/40" : level === "low" ? "border-[#f59e0b]/40" : "border-white/10"
      }`}
    >
      <div className="flex items-stretch">
        <button
          onClick={() => setOpen((o) => !o)}
          data-testid={`stock-toggle-${product.product_id}`}
          className="flex flex-1 items-center gap-3 p-4 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a2f]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/10 bg-[#0f1216]">
            <Package size={17} className="text-[#ff7a2f]" weight="duotone" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-head font-semibold text-white text-sm">{product.name}</p>
              {badge && (
                <span
                  data-testid={`stock-level-${product.product_id}`}
                  className="shrink-0 font-mono text-[9px] font-bold tracking-wider px-1.5 py-0.5 border"
                  style={{ color: badge.color, borderColor: `${badge.color}55`, backgroundColor: `${badge.color}14` }}
                >
                  {badge.label}
                </span>
              )}
            </div>
            <p className="font-mono text-[11px] text-white/40">
              {product.category} · {product.vendors?.length} vendors
            </p>
          </div>
          <div className="text-right">
            <p
              data-testid={`stock-total-${product.product_id}`}
              className={`font-mono text-sm font-bold ${level === "out" ? "text-red-400" : level === "low" ? "text-[#f59e0b]" : "text-white"}`}
            >
              {level === "out" ? "OUT" : total.toLocaleString("en-IN")}
            </p>
            <p className="font-mono text-[10px] text-white/40">
              from {formatINR(minPrice)}/{product.unit}
            </p>
          </div>
          <CaretDown size={16} className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {badge && (
          <button
            onClick={() => openPicker(null)}
            data-testid={`reorder-btn-${product.product_id}`}
            title="Reorder"
            className="flex shrink-0 items-center gap-1.5 border-l border-white/10 bg-[#ff7a2f] px-3 font-head text-[11px] font-bold tracking-wide text-[#0f1216] transition-colors hover:bg-[#ff8c4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a2f]"
          >
            <Lightning size={14} weight="fill" />
            <span className="hidden sm:inline">REORDER</span>
          </button>
        )}
      </div>

      {open && (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {product.vendors?.map((v) => {
            const vOut = v.stock <= 0;
            return (
              <div
                key={v.vendor_id}
                data-testid={`stock-vendor-${product.product_id}-${v.vendor_id}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-white/85">
                    <Storefront size={13} className="text-[#ff7a2f]" />
                    {v.vendor_name}
                  </span>
                  <div className="mt-1">
                    <StarRating value={v.rating} size={11} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {vOut ? (
                      <span className="flex items-center justify-end gap-1 font-mono text-[11px] font-semibold text-red-400">
                        <Warning size={12} weight="fill" /> OUT OF STOCK
                      </span>
                    ) : (
                      <p className="font-mono text-xs text-white/80">
                        {v.stock.toLocaleString("en-IN")} {product.unit}
                      </p>
                    )}
                    <p className="font-mono text-[11px] text-[#ff7a2f]">{formatINR(v.price)}</p>
                  </div>
                  <button
                    onClick={() => openPicker(v)}
                    data-testid={`reorder-vendor-btn-${product.product_id}-${v.vendor_id}`}
                    title={`Reorder from ${v.vendor_name}`}
                    className="flex items-center gap-1 border border-[#ff7a2f]/50 px-2 py-1.5 font-mono text-[10px] font-bold tracking-wider text-[#ff7a2f] transition-colors hover:bg-[#ff7a2f]/10"
                  >
                    <ArrowUUpLeft size={12} weight="bold" /> REORDER
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          data-testid={`reorder-dialog-${product.product_id}`}
          className="border border-white/10 bg-[#171c22] text-white sm:max-w-md [&>button]:text-white/50"
        >
          <DialogHeader>
            <DialogTitle className="font-head tracking-tight">
              Reorder · <span className="text-[#ff7a2f]">{product.name}</span>
            </DialogTitle>
          </DialogHeader>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-white/40">Choose vendor</p>
            <div className="max-h-52 space-y-1.5 overflow-auto">
              {product.vendors?.map((v) => (
                <button
                  key={v.vendor_id}
                  onClick={() => setVendorId(v.vendor_id)}
                  data-testid={`reorder-vendor-option-${v.vendor_id}`}
                  className={`flex w-full items-center justify-between gap-2 border px-3 py-2.5 text-left transition-colors ${
                    vendorId === v.vendor_id ? "border-[#ff7a2f] bg-[#ff7a2f]/10" : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-white/90">
                      <Storefront size={13} className="text-[#ff7a2f]" /> {v.vendor_name}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <StarRating value={v.rating} size={10} />
                      <span className={`font-mono text-[10px] ${v.stock <= 0 ? "text-red-400" : "text-white/40"}`}>
                        {v.stock <= 0 ? "out of stock" : `${v.stock.toLocaleString("en-IN")} ${product.unit}`}
                      </span>
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-[#ff7a2f]">{formatINR(v.price)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-white/40">
              Quantity ({product.unit})
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty((q) => Math.max(step, Number(q) - step))}
                className="flex h-10 w-10 items-center justify-center border border-white/10 text-white/70 transition-colors hover:bg-white/5"
                data-testid="reorder-qty-minus"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                data-testid="reorder-qty-input"
                className="h-10 flex-1 border border-white/10 bg-[#0f1216] px-3 text-center font-mono text-sm text-white outline-none focus:border-[#ff7a2f]"
              />
              <button
                onClick={() => setQty((q) => Number(q) + step)}
                className="flex h-10 w-10 items-center justify-center border border-white/10 text-white/70 transition-colors hover:bg-white/5"
                data-testid="reorder-qty-plus"
              >
                <Plus size={14} />
              </button>
            </div>
            {selectedVendor && Number(qty) > 0 && (
              <p className="mt-2 text-right font-mono text-[11px] text-white/50">
                est. {formatINR(selectedVendor.price * Number(qty))}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setPickerOpen(false)}
              className="border border-white/10 px-4 py-2.5 text-xs text-white/70 transition-colors hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={submitting || !vendorId || Number(qty) <= 0}
              data-testid="reorder-confirm-btn"
              className="flex items-center justify-center gap-1.5 bg-[#ff7a2f] px-4 py-2.5 font-head text-xs font-bold tracking-wide text-[#0f1216] transition-colors hover:bg-[#ff8c4d] disabled:opacity-50"
            >
              {submitting ? <CircleNotch size={14} className="animate-spin" /> : <Lightning size={14} weight="fill" />}
              PLACE REORDER
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
